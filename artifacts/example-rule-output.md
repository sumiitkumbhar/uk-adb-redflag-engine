# Example Rule Output

## Input Summary
- Building: Block of flats
- Top storey height: 6 m
- Sprinklers: No
- Corridor travel distance: 10 m
- Lobby travel distance: 5.2 m
- Spandrel height: 700 mm
- Required spandrel height: 900 mm

## Engine Output

### ❌ FAIL — Spandrel Protection
- Reason: 700 mm provided vs 900 mm required
- Mitigation: Increase spandrel height to minimum requirement

### ❌ FAIL — Sprinkler Strategy
- Reason: No sprinklers provided in building configuration
- Mitigation: Consider sprinkler installation or revise fire strategy

### ✅ PASS — Travel Distance
- Reason: Within allowable limits

### ⚠️ WARNING — Stair Strategy
- Reason: Single stair arrangement increases evacuation sensitivity
- Mitigation: Review evacuation assumptions and risk profile