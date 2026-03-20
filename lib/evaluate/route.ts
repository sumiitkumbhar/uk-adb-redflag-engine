// app/api/evaluate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { Building, RuleResult } from "@/lib/types";
import { ALL_RULES } from "@/lib/rules/core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const building: Building = body.building;

    // Insert building row
    const { data: buildingRow, error: bErr } = await supabase
      .from("buildings")
      .insert({
        name: body.name ?? "Untitled",
        volume: building.volume,
        purpose_group: building.purposeGroup,
        height_top_storey_m: building.heightTopStorey_m,
        lowest_basement_depth_m: building.lowestBasementDepth_m,
        has_sprinklers: building.hasSprinklers,
        has_phased_evacu: building.hasPhasedEvac,
        model: building
      })
      .select()
      .single();

    if (bErr) {
      console.error(bErr);
      return NextResponse.json({ error: "Failed to save building" }, { status: 500 });
    }

    const buildingId = buildingRow.id as string;

    // Run applicable rules
    const allResults: RuleResult[] = [];
    const buildingWithId: Building = { ...building, id: buildingId };

    for (const rule of ALL_RULES) {
      if (!rule.applies(buildingWithId)) continue;
      const res = rule.evaluate(buildingWithId);
      allResults.push(...res);
    }

    // Upsert rule catalogue
    const ruleCatalogRows = ALL_RULES.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      severity: r.severity,
      volume: r.source.volume,
      paragraph: r.source.paragraph,
      adb_table: r.source.table ?? null,
      diagram: r.source.diagram ?? null
    }));

    const { error: rulesErr } = await supabase
      .from("fire_rules")
      .upsert(ruleCatalogRows, { onConflict: "id" });

    if (rulesErr) {
      console.error(rulesErr);
    }

    // Store results
    if (allResults.length > 0) {
      const resultRows = allResults.map(r => ({
        building_id: buildingId,
        rule_id: r.ruleId,
        passed: r.passed,
        severity: r.severity,
        message: r.message,
        location_ref: r.locationRef ?? null,
        details: r.details ?? {}
      }));
      const { error: resErr } = await supabase
        .from("fire_rule_results")
        .insert(resultRows);

      if (resErr) {
        console.error(resErr);
      }
    }

    return NextResponse.json({ buildingId, results: allResults }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
