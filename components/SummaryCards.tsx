"use client";

type Props = {
  complianceScore?: number | null;
  completenessScore?: number | null;
  pass?: number | null;
  fail?: number | null;
  unknown?: number | null;
  totalRules?: number | null;
};

function safe(v: number | null | undefined) {
  return typeof v === "number" ? v : 0;
}

export default function SummaryCards(props: Props) {
  const cards = [
    {
      label: "Compliance Score",
      value: safe(props.complianceScore),
    },
    {
      label: "Completeness Score",
      value: safe(props.completenessScore),
    },
    {
      label: "FAIL",
      value: safe(props.fail),
    },
    {
      label: "UNKNOWN",
      value: safe(props.unknown),
    },
    {
      label: "PASS",
      value: safe(props.pass),
    },
    {
      label: "Total Rules",
      value: safe(props.totalRules),
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginTop: 18,
        marginBottom: 18,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="card"
          style={{
            padding: 14,
            minHeight: 92,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div className="muted2" style={{ marginBottom: 6 }}>
            {card.label}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}