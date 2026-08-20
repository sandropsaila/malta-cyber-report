// GitHub Action script — runs daily, updates data.json
// ONLY updates: fetched timestamp + live_news array
// PRESERVES: confirmed_incidents, court_cases (manually curated)

const https = require("https");
const fs    = require("fs");

const SYSTEM_PROMPT = `You are a cybersecurity intelligence analyst specialising in Malta.

STRICT MALTA-RELEVANCE FILTER — MANDATORY:
Only include incidents with a CLEAR and DIRECT Malta connection:
- VICTIM: org HQ/licensed in Malta, Maltese citizens' data, Maltese govt targeted, Malta infrastructure
- ATTACKER: Maltese suspect arrested, attack from Malta, Maltese entity in Europol/NCA operation
- REGULATORY: IDPC/MGA/MFSA/MDIA decision, Maltese court ruling, Malta company in intl cybercrime op
DO NOT INCLUDE: generic global breaches with no Malta link, EU-wide stats not naming Malta

Search ALL of the following sources:
1. NEWS PORTALS: maltatoday.com.mt, timesofmalta.com, independent.com.mt, theshiftnews.com,
   lovinmalta.com, newsbook.com.mt, maltadaily.mt, tvm.com.mt, illum.com.mt, netnews.com.mt, onenews.com.mt
2. MALTESE REGULATORS & GOVERNMENT: mga.org.mt (Enforcement Register), mfsa.mt (Enforcement Dashboard + circulars),
   idpc.org.mt (Decisions page), mdia.org.mt, mita.gov.mt, MSS Parliamentary Reports,
   FCID Police Statistics, Transport Malta, MTCA, Identity Malta, Lands Authority,
   csirtmalta.gov.mt (national CSIRT — coordinated vulnerability disclosures, incident advisories),
   parlament.mt (Parliamentary Questions — MPs regularly file PQs on specific cyber incidents),
   nao.gov.mt (National Audit Office — annual and thematic audits often reveal past incidents),
   justice.gov.mt (Court judgement search — Computer Misuse Act Art. 337 prosecutions),
   fiau.gov.mt (Financial Intelligence Analysis Unit enforcement register — CSP/gaming/VFA cases),
   mbr.mt (Malta Business Registry — sudden dissolutions often follow ransomware collapse),
   mca.org.mt (Malta Communications Authority — mandatory NIS2 telecom incident notifications),
   ombudsman.org.mt (cyber-related complaints against public bodies),
   deputyprimeminister.gov.mt (Ministry of Health — mandatory health-sector NIS2 disclosures),
   transport.gov.mt (Aviation & Maritime Directorates — sector-specific incident reports)
3. SOCIAL: LinkedIn (CISO/authority posts), Facebook (org announcements), Twitter/X, Reddit r/malta
4. IGAMING: igamingcapital.mt, igamingbusiness.com, sigma.world, next.io, tribuna.com, calvin.ayre.com
5. EU BODIES: ENISA, EDPB, Europol, EUR-Lex (Malta-specific enforcement only)
6. SECURITY INTELLIGENCE: GDPRhub (IDPC decisions), DataBreaches.net, HaveIBeenPwned,
   BleepingComputer, SecurityWeek, The Record, Cybernews, OCCRP, Daphne Foundation,
   infostealers.com (HudsonRock — infostealer logs, credential theft, Jira/VPN breach intelligence),
   hudsonrock.com/threat-intelligence-cybercrime-tools (credential exposure lookup),
   recordedfuture.com (threat intelligence platform — search Malta-tagged intel),
   spycloud.com (stolen credential & infostealer data — Malta-linked exposures),
   group-ib.com (cybercrime investigation & threat intel — Malta/iGaming incidents),
   kroll.com/en/insights/publications/cyber/threat-intelligence (Kroll cyber threat reports),
   zerofox.com (external threat intelligence — Malta brand/executive exposure),
   intel471.com (underground & dark web intel — Malta-linked actors),
   anomali.com (threat intelligence platform — Malta IOC searches),
   constellaintelligence.com (threat intelligence — Malta-linked incidents),
   blueliv.com (threat intelligence — European/Malta cyber threats),
   csis.org/programs/strategic-technologies-program/significant-cyber-incidents (CSIS significant cyber incidents tracker),
   cnas.org/publications/reports/cyber-incident-tracker (CNAS cyber incident tracker)
7. INFOSTEALER RESOURCES: breachsense.com/blog (infostealer & credential breach monitoring),
   f6s.com/software/category/infostealer-detection (infostealer tool landscape),
   infosecurityeurope.com (infostealer malware guides & incident coverage),
   cyber.gov.au infostealer advisory (ASD/ACSC infostealer malware advisory — techniques applicable to Malta operators),
   shadowdragon.io/resources (threat intelligence platform coverage)
8. PROACTIVE: Shodan (Maltese IP ranges), VirusTotal/MalwareBazaar, Google News,
   spc.int (Pacific — cross-reference for any Malta-linked Pacific-region incidents),
   density.io (threat intelligence aggregation)
9. DARK-WEB / LEAK-SITE AGGREGATORS: legal-isac.org RansomWatch (country-filtered victim tracker),
   breachsense.com (month-by-month leak-site breach reports), redpacketsecurity.com,
   ransomlook.io, ransomware.live, darkfeed.io (parallel leak-site tracker),
   falconfeeds.io (parallel tracker; different scraping pipeline catches different announcements),
   cyble.com (Cyble Vision — dark web intel with country tagging),
   socradar.io (free country dashboards),
   intelx.io (IntelX — deep search across pastebin, Telegram, leaked archives for .com.mt/.gov.mt),
   kelacyber.com (KELA — subscription only; occasional public Malta reports),
   flashpoint.io, cybersixgill.com
10. CREDENTIAL / INFOSTEALER EXPANSION: dehashed.com, snusbase.com, leakcheck.io
    (credential-exposure databases — query by @companyname.com.mt),
    crt.sh (Certificate Transparency logs — new .mt SSL certs during incident recovery
    indicate breach response), haveibeenpwned.com Enterprise API (bulk domain-based lookup)
11. FREE / COMMUNITY THREAT-INTEL PLATFORMS: otx.alienvault.com (AlienVault OTX — country pulse tagging),
    misp-project.org (MISP — EU-level threat sharing with country filters; CSIRT Malta may share IoCs),
    opencti.io (OpenCTI — open-source threat intel platform),
    urlhaus.abuse.ch (Maltese IP / hosting monitoring), feodotracker.abuse.ch,
    chainalysis.com (crypto ransom payment tracking by country),
    coveware.com (quarterly ransomware reports often break down by country)
12. INFRASTRUCTURE SCANNERS (Shodan alternatives, catch different Malta-hosted services):
    censys.io, binaryedge.io, zoomeye.hk, netlas.io, fofa.info
13. ACADEMIC / RESEARCH: repository.um.edu.mt (OAR@UM — MSc theses and lecturer papers on
    Maltese cyber case studies; often the deepest technical analyses), sans.org/reading-room
    (occasional Malta-focused papers), ieeexplore.ieee.org and link.springer.com
    (Maltese cyber case studies in academic journals)

TARGETED SWEEP STRATEGY — MANDATORY (this is how you find incidents that NEVER reached the news):
Many Malta breaches are never reported by Maltese media. The ONLY public trace is a dark web
leak-site listing or a threat-intel database entry. You MUST search by Malta IDENTIFIERS, not
by waiting for news coverage. Run ALL of these targeted query patterns:

A. DARK WEB LEAK-SITE SWEEP — search ransomware leak trackers for Maltese victims by domain:
   - Query pattern: ".com.mt" OR ".mt" + [ransomware group] + "victim" OR "leak"
   - Query pattern: "Malta" site:breachsense.com OR site:redpacketsecurity.com OR
     ransomlook.io OR ransomware.live OR darkfeed.io OR falconfeeds.io OR
     legal-isac.org OR cyble.com OR socradar.io
   - Check leak-site victim lists for: Akira, Qilin, LockBit, Play, RansomHub, Cl0p, HellCat,
     Medusa, INC, BlackCat/ALPHV, Rhysida, SafePay, NightSpire, Lynx — filter for .mt domains
   - intelx.io deep search for ".com.mt"/".gov.mt" mentions across pastebin + Telegram archives
B. INFOSTEALER / CREDENTIAL SWEEP — search for Maltese domains in stealer logs:
   - Query pattern: ".com.mt" OR ".gov.mt" credentials infostealer log site:infostealers.com
   - Query pattern: "Malta" OR ".mt" exposed credentials site:spycloud.com OR hudsonrock.com
   - Query pattern: "@companyname.com.mt" site:dehashed.com OR snusbase.com OR leakcheck.io
   - crt.sh new .mt certificate transparency events (breach-response indicator)
C. THREAT-INTEL DATABASE SWEEP — query each platform with Malta as the search term:
   - "Malta" cyber incident on recordedfuture.com, group-ib.com, intel471.com, zerofox.com,
     anomali.com, constellaintelligence.com, blueliv.com, kroll.com
   - Free-tier alternatives: otx.alienvault.com pulses, misp-project.org country filter,
     urlhaus.abuse.ch (Maltese IPs), feodotracker.abuse.ch
   - Ransomware statistics with country breakdown: chainalysis.com, coveware.com quarterly
D. INCIDENT-TRACKER SWEEP — scan named incident trackers for any Malta entry:
   - CSIS Significant Cyber Incidents list, CNAS Cyber Incident Tracker — Ctrl-F "Malta"
E. REGULATOR / GOVERNMENT ENFORCEMENT SWEEP — directly read enforcement/decision registers:
   - mga.org.mt enforcement register, mfsa.mt enforcement dashboard, idpc.org.mt decisions
   - csirtmalta.gov.mt advisories, mca.org.mt (NIS2 telecom notifications)
   - fiau.gov.mt (financial cyber-crime enforcement — CSP, gaming, VFA)
   - parlament.mt Parliamentary Questions (MP-filed PQs on specific incidents)
   - nao.gov.mt (National Audit Office — annual audits and thematic reports)
   - justice.gov.mt court judgement search (Computer Misuse Act Art. 337 cases)
   - mbr.mt Malta Business Registry (dissolutions/liquidations following ransomware)
   - ombudsman.org.mt (cyber-related complaints against public bodies)
   - deputyprimeminister.gov.mt (Ministry of Health — NIS2 health-sector disclosures)
   - transport.gov.mt (Aviation & Maritime Directorate reports)
F. NEWS / SOCIAL SWEEP — the 11 Maltese portals + LinkedIn/X/Reddit (as before)
H. INFRASTRUCTURE SCANNER SWEEP — Malta-hosted service exposure that could precede/follow a breach:
   - Shodan Malta IP ranges (AS12709 Melita, AS15735 GO plc, AS8823 EPIC/Vodafone),
     censys.io, binaryedge.io, zoomeye.hk, netlas.io, fofa.info — each has different
     scanning cadences; running the same Malta ASN query across all catches services
     Shodan alone misses
I. ACADEMIC SWEEP — case studies with technical depth not found in news:
   - repository.um.edu.mt (OAR@UM) MSc theses on Maltese cyber incidents
   - sans.org/reading-room, ieeexplore.ieee.org, link.springer.com for Malta-tagged papers
G. NIMBLE INTELLIGENCE SWEEP (when running via Claude Chat/App with MCP access):
   Nimble's country-filtered search, news focus, and deep extraction find intel that
   standard web_search misses — country="MT" surfaces Malta-tagged results from trackers
   that don't title-tag by country. Run these Nimble queries:
   - nimble_search(query="Malta cyber attack ransomware", country="MT", focus="news", time_range="month")
     — Malta-geo news aggregation
   - nimble_search(query=".com.mt OR .gov.mt data breach ransomware", focus="general",
     search_depth="deep", time_range="year") — deep web extraction of Malta domain victims
   - nimble_search(query="[victim domain] Malta company", search_depth="deep") to verify
     ambiguous MT vs Mato Grosso (Brazil) domain hits
   - nimble_extract on Legal-ISAC RansomWatch (legal-isac.org/ransomware) and
     breachsense.com month pages for structured victim data with country codes
   - For ambiguous ".mt" domains: Malta always has .com.mt / .gov.mt / .edu.mt / .org.mt;
     Brazilian Mato Grosso uses .mt.gov.br — never confuse the two
   This is how Tax-MT/Play ransomware was discovered in July 2026, missed by 6 prior
   standard-search sweeps.

For EACH category A-I run at least one dedicated query (skip G on automated backend runs
that lack MCP access — the automated Claude API cannot call Nimble tools). Do NOT rely on a
single broad "Malta cyberattack" search — that is exactly what missed the Intercomp Malta /
Akira and Tax-MT / Play incidents.
A breach with ONLY a dark web leak-site listing and NO news coverage still qualifies and MUST
be included if the victim domain or organisation is Maltese.

Return a JSON array of up to 15 recent items. Each must have:
- title: string
- source: string (publication, leak-site, or threat-intel platform)
- date: string (e.g. "May 2026")
- url: string (full article or leak-tracker URL)
- summary: string (2-3 sentences including authority response if any)
- severity: "critical" | "high" | "medium" | "low"
- sector: string (include authority name e.g. "Financial Services (MFSA)")
- malta_connection: string (WHY this qualifies — e.g. ".mt domain", "MGA-licensed")
- detection_source: string (which sweep category A-F surfaced this: e.g. "A - dark web leak-site")

Today is \${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Prioritise incidents from the past 12 months.
Return ONLY valid JSON array, no markdown, no preamble.`;

function callAnthropic(apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Today is ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Run the FULL TARGETED SWEEP (categories A-F) for Malta cybersecurity incidents.
Do NOT rely on a single broad "Malta cyberattack" query — that misses leak-site-only victims.

SWEEP A — Dark web leak-site sweep: search for ".com.mt" / ".mt" victims on breachsense.com,
  redpacketsecurity.com, ransomlook.io, ransomware.live, darkfeed.io, falconfeeds.io,
  legal-isac.org, cyble.com, socradar.io; intelx.io deep search. Check Akira, Qilin, LockBit,
  Play, RansomHub, Cl0p, HellCat, Medusa, INC, BlackCat, Rhysida, SafePay, NightSpire, Lynx
  victim lists.
SWEEP B — Infostealer/credential sweep: ".com.mt"/".gov.mt" credentials on infostealers.com,
  hudsonrock.com, spycloud.com, dehashed.com, snusbase.com, leakcheck.io; crt.sh certificate
  transparency for new .mt certs.
SWEEP C — Threat-intel database sweep: query "Malta" on recordedfuture.com, group-ib.com,
  intel471.com, zerofox.com, anomali.com, constellaintelligence.com, blueliv.com, kroll.com,
  otx.alienvault.com, misp-project.org, urlhaus.abuse.ch, feodotracker.abuse.ch,
  chainalysis.com, coveware.com.
SWEEP D — Incident-tracker sweep: scan CSIS Significant Cyber Incidents + CNAS Cyber Incident
  Tracker for any "Malta" entry.
SWEEP E — Regulator / Government enforcement sweep: mga.org.mt, mfsa.mt, idpc.org.mt,
  csirtmalta.gov.mt (national CSIRT advisories), parlament.mt (Parliamentary Questions),
  nao.gov.mt (National Audit Office reports), justice.gov.mt (court judgements — Art. 337),
  fiau.gov.mt (financial cyber-crime), mbr.mt (dissolutions), mca.org.mt (NIS2 telecom),
  ombudsman.org.mt, health ministry (NIS2 health), transport.gov.mt (aviation & maritime).
SWEEP F — News/social sweep: 11 Maltese portals (maltatoday, timesofmalta, independent,
  theshiftnews, lovinmalta, newsbook, netnews, onenews, tvm, illum, maltadaily), iGaming
  (igamingcapital, next.io, tribuna.com, sigma.world), LinkedIn, X, Reddit r/malta.
SWEEP H — Infrastructure scanner sweep: Shodan + censys.io + binaryedge.io + zoomeye.hk +
  netlas.io + fofa.info for Malta ASN queries (AS12709 Melita, AS15735 GO, AS8823 EPIC).
SWEEP I — Academic sweep: repository.um.edu.mt (OAR@UM theses), sans.org/reading-room,
  ieeexplore.ieee.org, link.springer.com for Malta-tagged cyber case studies.
SWEEP G — Nimble intelligence sweep (manual runs with MCP access only): country="MT"
  filtered nimble_search on news + general focus; nimble_extract on Legal-ISAC
  RansomWatch (legal-isac.org/ransomware) and breachsense.com month pages; verify any
  ambiguous ".mt" domain (Malta .com.mt / .gov.mt vs Brazilian Mato Grosso .mt.gov.br).

Run at least one dedicated query per category A-I (skip G on automated backend runs
that lack MCP access — the automated Claude API cannot call Nimble tools). Apply the
strict Malta-relevance filter. Include leak-site-only victims with no news coverage.
Return JSON array only.`
      }]
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          let text = "";
          if (parsed.content) {
            for (const block of parsed.content) {
              if (block.type === "text") text += block.text;
            }
          }
          const match = text.match(/\[[\s\S]*\]/);
          if (!match) throw new Error("No JSON array in response");
          resolve(JSON.parse(match[0]));
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("No ANTHROPIC_API_KEY set"); process.exit(1); }

  console.log("Searching 48 Malta cyber sources...");
  const liveNews = await callAnthropic(apiKey);
  console.log(`Got ${liveNews.length} live news items`);

  // Read existing data.json to preserve confirmed_incidents + court_cases
  let existing = {};
  if (fs.existsSync("data.json")) {
    existing = JSON.parse(fs.readFileSync("data.json", "utf8"));
  }

  const SOURCES = [
    "maltatoday.com.mt","timesofmalta.com","independent.com.mt","theshiftnews.com",
    "lovinmalta.com","newsbook.com.mt","maltadaily.mt","tvm.com.mt","illum.com.mt",
    "netnews.com.mt","onenews.com.mt",
    "mga.org.mt (incl. Enforcement Register)","mfsa.mt (incl. Enforcement Dashboard)",
    "idpc.org.mt (incl. Decisions page)","mdia.org.mt","mita.gov.mt",
    "MSS Parliamentary Reports","FCID Police Statistics",
    "Transport Malta","MTCA","Identity Malta","Lands Authority",
    "csirtmalta.gov.mt (National CSIRT)","parlament.mt (Parliamentary Questions)",
    "nao.gov.mt (National Audit Office)","justice.gov.mt (Court judgements — Art. 337)",
    "fiau.gov.mt (Financial Intelligence Analysis Unit)","mbr.mt (Malta Business Registry)",
    "mca.org.mt (Malta Communications Authority)","ombudsman.org.mt",
    "deputyprimeminister.gov.mt (Ministry of Health — NIS2)","transport.gov.mt (Aviation & Maritime)",
    "LinkedIn","Facebook","Twitter/X","Reddit r/malta",
    "igamingcapital.mt","igamingbusiness.com","sigma.world","next.io","tribuna.com","calvin.ayre.com",
    "ENISA","EDPB","Europol","EUR-Lex",
    "GDPRhub","DataBreaches.net","HaveIBeenPwned","BleepingComputer",
    "SecurityWeek","The Record","Cybernews","OCCRP","Daphne Foundation","infostealers.com (HudsonRock)",
    "hudsonrock.com/threat-intelligence-cybercrime-tools","recordedfuture.com","spycloud.com",
    "group-ib.com","kroll.com/cyber/threat-intelligence","zerofox.com","intel471.com",
    "anomali.com","constellaintelligence.com","blueliv.com",
    "csis.org/significant-cyber-incidents","cnas.org/cyber-incident-tracker",
    "breachsense.com/blog","f6s.com/infostealer-detection",
    "infosecurityeurope.com","shadowdragon.io/resources",
    "Shodan","VirusTotal/MalwareBazaar","Google News","spc.int","density.io",
    "Nimble (nimbleway.com — country=MT filtered search)","legal-isac.org RansomWatch",
    "ransomlook.io","ransomware.live","redpacketsecurity.com","darkfeed.io","falconfeeds.io",
    "cyble.com (Cyble Vision)","socradar.io","intelx.io","kelacyber.com","flashpoint.io","cybersixgill.com",
    "dehashed.com","snusbase.com","leakcheck.io","crt.sh (Certificate Transparency)","HIBP Enterprise API",
    "otx.alienvault.com (AlienVault OTX)","misp-project.org (MISP)","opencti.io",
    "urlhaus.abuse.ch","feodotracker.abuse.ch","chainalysis.com","coveware.com",
    "censys.io","binaryedge.io","zoomeye.hk","netlas.io","fofa.info",
    "repository.um.edu.mt (OAR@UM)","sans.org/reading-room","ieeexplore.ieee.org","link.springer.com"
  ];

  // Write updated data.json — preserve curated data, update live feed + timestamp
  const output = {
    fetched: new Date().toISOString(),
    confirmed_incidents: existing.confirmed_incidents || [],
    court_cases: existing.court_cases || [],
    live_news: liveNews,
    sources_searched: SOURCES,
    filter_applied: "Strict Malta-relevance filter: victim/attacker/regulatory connection to Malta required"
  };

  fs.writeFileSync("data.json", JSON.stringify(output, null, 2));
  console.log(`data.json updated: ${output.confirmed_incidents.length} incidents, ${output.court_cases.length} court cases, ${liveNews.length} live news`);
  console.log(`Timestamp: ${output.fetched}`);
}

main().catch(e => { console.error(e); process.exit(1); });
