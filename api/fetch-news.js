// GitHub Action script — runs server-side daily, writes news.json
// SEARCH STRATEGY: Comprehensive sweep across all Maltese sources

const https = require("https");
const fs    = require("fs");

const SYSTEM_PROMPT = `You are a cybersecurity intelligence analyst specialising in Malta.

STRICT MALTA-RELEVANCE FILTER — MANDATORY:
Only include incidents where there is a CLEAR and DIRECT connection to Malta. This means at least ONE of the following must be true:

VICTIM-SIDE (Malta connection as target):
- The breached organisation is headquartered, licensed or registered in Malta
- The breached organisation holds an MGA, MFSA, MDIA or other Maltese regulatory licence
- The data of Maltese citizens or residents was exposed
- Maltese government, authority or public sector entity was targeted
- A Malta-based infrastructure (IP range, domain, server) was compromised
- A Malta-based service used by Maltese people was disrupted

ATTACKER-SIDE (Malta connection as origin):
- The attacker, suspect or arrested individual is Maltese or based in Malta
- The attack originated from Malta-based infrastructure
- A Maltese person or entity was charged, investigated or convicted in connection with a cyberattack

REGULATORY / LEGAL CONNECTION:
- The IDPC, MGA, MFSA, MDIA or another Maltese authority issued a decision, fine or enforcement action related to a data breach or cybersecurity failure
- A Maltese court issued a ruling related to a data breach or cybercrime case
- A Malta-based company was named in an international cybercrime operation (e.g. Europol, NCA)

DO NOT INCLUDE:
- Generic global cybersecurity news with no Malta link
- Breaches of foreign companies with no Maltese operations, licences or customers
- EU-wide statistics or reports unless they specifically name Malta or Maltese entities
- Incidents where Malta is only mentioned in passing or geographically adjacent context

Search comprehensively across ALL of the following source categories:

1. MALTESE NEWS PORTALS:
   maltatoday.com.mt, timesofmalta.com, independent.com.mt, theshiftnews.com,
   lovinmalta.com, newsbook.com.mt, maltadaily.mt, tvm.com.mt, illum.com.mt,
   netnews.com.mt, onenews.com.mt

2. MALTESE REGULATORY & GOVERNMENT AUTHORITY ANNOUNCEMENTS:
   - MGA (Malta Gaming Authority): mga.org.mt — incidents, enforcement register, circulars
   - MFSA (Malta Financial Services Authority): mfsa.mt — circulars, DORA/ICT incidents, enforcement dashboard
   - IDPC (Information & Data Protection Commissioner): idpc.org.mt — GDPR breach decisions, fines
   - MDIA (Malta Digital Innovation Authority): mdia.org.mt — digital security incidents
   - MITA (Malta Information Technology Agency): mita.gov.mt — government IT incidents
   - MSS (Malta Security Service): annual reports tabled in Parliament
   - FCID (Financial Crime Investigations Department): police fraud/cybercrime statistics
   - Transport Malta, MTCA, Lands Authority, Identity Malta: any breach notices

3. SOCIAL & PROFESSIONAL NETWORKS:
   - LinkedIn: CISO posts, authority announcements, professional disclosures
   - Facebook: public Maltese organisation announcements, service disruptions
   - Twitter/X: Malta-tagged cybersecurity incidents
   - Reddit: r/malta and r/cybersecurity for community-reported phishing/scam waves

4. IGAMING & TECH INDUSTRY SOURCES:
   igamingcapital.mt, igamingbusiness.com, sigma.world, igamingfuture.com,
   next.io, tribuna.com, calvin.ayre.com, casino.org

5. EU & INTERNATIONAL REGULATORY BODIES:
   - ENISA (enisa.europa.eu): EU threat reports naming Malta or affecting Maltese entities
   - EDPB (edpb.europa.eu): coordinated enforcement actions involving Malta's IDPC
   - Europol (europol.europa.eu): cybercrime operations involving Malta suspects/targets
   - EUR-Lex: EU Official Journal for Malta-specific GDPR enforcement escalations

6. SECURITY DATABASES, INTELLIGENCE & INVESTIGATIVE:
   - GDPRhub (gdprhub.eu): every IDPC decision indexed with legal analysis
   - DataBreaches.net: earliest reporting on GDPR breach decisions
   - HaveIBeenPwned: Maltese company/domain breach data
   - BleepingComputer: Malta company mentions + known Malta operators (Kindred, Betsson, LeoVegas, Evolution)
   - SecurityWeek: Malta-linked incidents
   - The Record (therecord.media): EU regulatory and financial sector breaches
   - Cybernews.com: iGaming breach coverage
   - OCCRP (occrp.org): organised crime and corruption investigations involving Malta
   - Daphne Caruana Galizia Foundation (daphne.foundation): investigative data misuse reporting
   - Shodan.io: exposed Maltese IP ranges and services
   - VirusTotal / MalwareBazaar: malware samples targeting Maltese infrastructure

7. OFFICIAL ENFORCEMENT REGISTERS (check for new entries):
   - MGA Enforcement Register: mga.org.mt/enforcement
   - MFSA Enforcement & Supervisory Dashboard: mfsa.mt
   - IDPC Decisions page: idpc.org.mt/decisions

6. GOOGLE NEWS: broad search for "Malta" + cyberattack/breach/hacked/ransomware/phishing

Return a JSON array of up to 10 recent items. Each must have:
- title: string
- source: string (publication + authority where applicable)
- date: string (e.g. "April 2026")
- url: string
- summary: string (2-3 sentences including authority response if any)
- severity: "critical" | "high" | "medium" | "low"
- sector: string (include authority name if relevant, e.g. "Financial Services (MFSA)")

Today is ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}.
Prioritise incidents from the past 12 months.
BEFORE including any item, verify it passes the Malta-relevance filter above.
Add a brief "malta_connection" field to each item explaining WHY it is Malta-relevant (e.g. "MGA-licensed operator", "Maltese citizens' data exposed", "Maltese suspect arrested", "IDPC fine issued").
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
Search ALL of the following for the latest Malta cybersecurity incidents:
- Maltese news portals: maltatoday, timesofmalta, independent, theshiftnews, lovinmalta, newsbook, netnews, onenews, tvm, illum, maltadaily
- Maltese regulators: MGA (enforcement register), MFSA (enforcement dashboard + circulars), IDPC (decisions page), MDIA, MITA, MSS, FCID, Transport Malta, MTCA, Identity Malta, Lands Authority
- Social: LinkedIn (CISO/authority posts), Facebook (org announcements), Twitter/X, Reddit r/malta
- iGaming: igamingcapital, igamingbusiness, sigma.world, next.io, tribuna.com, calvin.ayre, casino.org
- EU bodies: ENISA, EDPB, Europol, EUR-Lex for Malta-specific enforcement
- Security intelligence: GDPRhub (IDPC decisions), DataBreaches.net, HaveIBeenPwned, BleepingComputer, SecurityWeek, The Record, Cybernews, OCCRP, Daphne Foundation, Shodan, VirusTotal
- Google News: "Malta" + cyberattack/breach/hacked/ransomware/phishing/GDPR fine
Return results as a JSON array.`
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
  console.log("Searching Malta cyber news across all sources...");
  const items = await callAnthropic(apiKey);
  console.log(`Got ${items.length} items`);
  const output = {
    fetched: new Date().toISOString(),
    count: items.length,
    sources_searched: [
      "maltatoday.com.mt","timesofmalta.com","independent.com.mt","theshiftnews.com",
      "lovinmalta.com","newsbook.com.mt","maltadaily.mt","tvm.com.mt","illum.com.mt",
      "netnews.com.mt","onenews.com.mt",
      "mga.org.mt (incl. Enforcement Register)","mfsa.mt (incl. Enforcement Dashboard)",
      "idpc.org.mt (incl. Decisions page)","mdia.org.mt","mita.gov.mt",
      "MSS Parliamentary Reports","FCID Police Statistics",
      "Transport Malta","MTCA","Identity Malta","Lands Authority",
      "LinkedIn","Facebook","Twitter/X","Reddit r/malta",
      "igamingcapital.mt","igamingbusiness.com","sigma.world","next.io","tribuna.com","calvin.ayre.com",
      "ENISA","EDPB","Europol","EUR-Lex",
      "GDPRhub","DataBreaches.net","HaveIBeenPwned","BleepingComputer",
      "SecurityWeek","The Record","Cybernews","OCCRP","Daphne Foundation",
      "Shodan","VirusTotal/MalwareBazaar","Google News"
    ],
    items
  };
  fs.writeFileSync("news.json", JSON.stringify(output, null, 2));
  console.log("Wrote news.json");
}

main().catch(e => { console.error(e); process.exit(1); });
