// GitHub Action script — runs server-side, no CORS issues
// Called by the workflow, writes news.json to repo

const https = require("https");
const fs = require("fs");

const SYSTEM_PROMPT = `You are a cybersecurity intelligence analyst specialising in Malta.
Search for the latest cybersecurity incidents, data breaches, hacking events, ransomware attacks, 
phishing campaigns, and information security issues in Malta from these sources:
maltatoday.com.mt, timesofmalta.com, independent.com.mt, theshiftnews.com, lovinmalta.com, 
newsbook.com.mt, maltadaily.mt, tvm.com.mt, igamingcapital.mt, igamingbusiness.com

Return a JSON array of up to 10 recent news items. Each item must have:
- title: string
- source: string (publication name)  
- date: string (e.g. "April 2026")
- url: string (full article URL)
- summary: string (2-3 sentences)
- severity: "critical" | "high" | "medium" | "low"
- sector: string (e.g. "iGaming", "Government", "Healthcare", "Financial", "Telecoms")

Focus on incidents from the past 12 months. Return ONLY valid JSON array, no markdown, no preamble.`;

function callAnthropic(apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Today is ${new Date().toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})}. 
Search Maltese news portals for the latest cybersecurity incidents, data breaches, and information security issues in Malta. 
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
          const items = JSON.parse(match[0]);
          resolve(items);
        } catch(e) {
          reject(e);
        }
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

  console.log("Fetching Malta cyber news...");
  const items = await callAnthropic(apiKey);
  console.log(`Got ${items.length} items`);

  const output = {
    fetched: new Date().toISOString(),
    count: items.length,
    items
  };

  fs.writeFileSync("news.json", JSON.stringify(output, null, 2));
  console.log("Wrote news.json");
}

main().catch(e => { console.error(e); process.exit(1); });
