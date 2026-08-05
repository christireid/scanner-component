# Phase 0 — capability probe record

Latest probe: 2026-08-05, this environment (Claude Code remote runner).

## §3.1 checklist

```
[NO ] Can a headless browser reach https://gridpulse-scan-poncedeleonstudio.framer.website/ ?
[N/A] Can it execute the page's JavaScript?           — never reached the page
[N/A] Can it capture screenshots / computed styles?   — never reached the page
[N/A] Can it record video / frame sequences?          — never reached the page
[YES] Can a headless browser drive LOCAL pages, capture screenshots,
      read computed styles, and record frame sequences?  — Chromium 1194 via Playwright
```

## What was attempted, verbatim results

curl (through the session egress proxy):

```
https://gridpulse-scan-poncedeleonstudio.framer.website/            curl: (56) CONNECT tunnel failed, response 403
https://www.framer.com/community/marketplace/components/grid-pulse-scan/  same
https://specimen.framer.website/                                    same
https://www.framer.com/community/marketplace/components/specimen/   same
https://framerusercontent.com/assets/EprNzB0Gw5uu5rBnN59cK4VsnQ.mp4 same  ← the demo media asset
```

Real Chromium (Playwright, viewport 1200, deviceScaleFactor 2 — the §3.2 protocol):

```
https://gridpulse-scan-poncedeleonstudio.framer.website/  net::ERR_TUNNEL_CONNECTION_FAILED
https://www.framer.com/community/marketplace/...          net::ERR_TUNNEL_CONNECTION_FAILED
https://specimen.framer.website/                          net::ERR_TUNNEL_CONNECTION_FAILED
```

The failure is at the proxy CONNECT stage — an organisation egress-policy denial,
not bot detection, TLS, or a client limitation. The proxy documentation states
policy denials must be reported, not retried or circumvented. Web search reaches
the open web by another path and has no indexed description of either component.

## Rubric consequence

Every row of Sections B and C that requires observing the reference runtime is
UNVERIFIABLE-HERE. No timing, easing, colour, geometry, or formatting value is
scored as verified from inference. The demo media asset could not be fetched, so
point-placement comparisons are additionally impossible (§3.2E: detector output
is a function of the image).

## What IS possible here, and is being used

- The marketplace feature list (§2), quoted verbatim in the plan — scope contract.
- The plan's own tier-2 measured notes (chip case/tracking; effects target on the
  media; the 0.367 viewport scale trap).
- Local browser capture of OUR build: screenshots at every width, computed styles,
  frame sequences, preset distinctness. All local numbers in the docs come from
  this instrument or from the headless measurement tools.

## To convert B/C rows into measurements

Run the §3.2 capture protocol from any environment allowed to reach
`framer.com`, `*.framer.website`, and `framerusercontent.com`, at viewport 1200 /
DPR 2, and commit `test/reference/reference.json` plus `test/reference/frames/`.
The comparison harness in `tools/` consumes exactly that layout.
