const https = require("https");

// ── Shared tech alias table ───────────────────────────────────────────────────
// Used by both scoreJobAgainstProfile and (indirectly) the AI prompts.
const ALIASES = {
  javascript:       ["javascript", "js", "es6", "es2015", "ecmascript"],
  typescript:       ["typescript", "ts"],
  python:           ["python", "python3", "py"],
  react:            ["react", "reactjs", "react.js", "react js"],
  "next.js":        ["next.js", "nextjs", "next js"],
  vue:              ["vue", "vuejs", "vue.js", "vue js"],
  angular:          ["angular", "angularjs", "angular.js"],
  "node.js":        ["node.js", "nodejs", "node js", "node"],
  express:          ["express", "expressjs", "express.js"],
  mongodb:          ["mongodb", "mongo"],
  postgresql:       ["postgresql", "postgres", "pg"],
  mysql:            ["mysql", "sql"],
  html:             ["html", "html5"],
  css:              ["css", "css3"],
  tailwind:         ["tailwind", "tailwindcss", "tailwind css"],
  bootstrap:        ["bootstrap"],
  sass:             ["sass", "scss"],
  git:              ["git", "github", "gitlab", "version control"],
  docker:           ["docker", "dockerfile"],
  kubernetes:       ["kubernetes", "k8s"],
  aws:              ["aws", "amazon web services", "ec2", "s3", "lambda"],
  gcp:              ["gcp", "google cloud"],
  azure:            ["azure", "microsoft azure"],
  rest:             ["rest", "restful", "rest api"],
  graphql:          ["graphql"],
  redux:            ["redux", "redux toolkit"],
  java:             ["java"],
  spring:           ["spring", "spring boot", "springboot"],
  "c#":             ["c#", "csharp", "dotnet", ".net"],
  php:              ["php"],
  laravel:          ["laravel"],
  ruby:             ["ruby", "rails", "ruby on rails"],
  swift:            ["swift"],
  kotlin:           ["kotlin"],
  flutter:          ["flutter"],
  "react native":   ["react native", "reactnative"],
  firebase:         ["firebase"],
  redis:            ["redis"],
  elasticsearch:    ["elasticsearch", "elastic"],
  figma:            ["figma"],
  jira:             ["jira"],
  linux:            ["linux", "unix", "bash", "shell"],
  tensorflow:       ["tensorflow", "tf"],
  pytorch:          ["pytorch", "torch"],
  pandas:           ["pandas"],
  numpy:            ["numpy"],
  "machine learning": ["machine learning", "ml"],
  "deep learning":  ["deep learning", "dl"],
  "data science":   ["data science", "data analysis", "data analytics"],
  devops:           ["devops", "ci/cd", "cicd", "jenkins", "github actions"],
};

// Build reverse map once at module load: variant → canonical
const VARIANT_TO_CANONICAL = new Map();
for (const [canonical, variants] of Object.entries(ALIASES)) {
  for (const v of variants) VARIANT_TO_CANONICAL.set(v, canonical);
}

const normalize = (str) =>
  (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9#\+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toCanonical = (raw) => {
  const n = normalize(raw);
  return VARIANT_TO_CANONICAL.get(n) || n;
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Groq API (OpenAI-compatible).
 * Uses Node's built-in https — no extra dependency.
 */
const callGroq = (prompt) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const req = https.request(
      {
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error)
              return reject(new Error(`Groq error: ${JSON.stringify(json.error)}`));
            const content = json.choices?.[0]?.message?.content || "";
            const finish  = json.choices?.[0]?.finish_reason;
            if (!content.trim()) {
              return reject(
                new Error(
                  `AI returned empty content (finish_reason: ${finish || "unknown"}). ` +
                  `Try again or reduce the number of skills to prepare.`
                )
              );
            }
            resolve(content);
          } catch {
            reject(new Error("Failed to parse Groq response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

const stripFences = (text) =>
  text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

const isYouTubeUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    );
  } catch {
    return false;
  }
};

const createYouTubeSearchResource = (skill, topic) => {
  const searchQuery = [skill, topic, "tutorial"].filter(Boolean).join(" ");
  return {
    title: `YouTube tutorials for ${skill ? `${skill}: ` : ""}${topic}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * analyzeResumeWithAI
 * Calls Groq to extract a structured profile from raw resume text.
 */
const analyzeResumeWithAI = async (resumeText) => {
  const prompt = `
You are an expert resume analyzer. Analyze the resume text below and extract the following information.

Return ONLY a valid JSON object with no markdown, no code fences, and no extra text.

Resume Text:
"""
${resumeText}
"""

Return this exact JSON shape:
{
  "skills": ["list of technical and soft skills found"],
  "technologies": ["programming languages, frameworks, tools, databases, platforms"],
  "education": "highest education qualification as a short string",
  "experience": "total years of experience and key roles as a short string",
  "domain": "primary job domain or field (e.g. Web Development, Data Science, DevOps, UI/UX, etc.)",
  "summary": "2-3 sentence professional summary based on the resume"
}

Rules:
- skills should be individual items, not sentences
- technologies should be specific tool/language/framework names
- If a field cannot be determined, use an empty array or empty string
- Do not include any explanation, only return the JSON
`;

  try {
    const parsed = JSON.parse(stripFences(await callGroq(prompt)));
    return {
      skills:       Array.isArray(parsed.skills)       ? parsed.skills       : [],
      technologies: Array.isArray(parsed.technologies) ? parsed.technologies : [],
      education:    parsed.education  || "",
      experience:   parsed.experience || "",
      domain:       parsed.domain     || "",
      summary:      parsed.summary    || "",
    };
  } catch (err) {
    console.error("[resumeAnalyzerService] Groq error:", err.message);
    throw new Error("AI analysis failed. Please try again later.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * scoreJobAgainstProfile
 *
 * Classifies job-required skills into three buckets:
 *  - matchedSkills         : candidate already has these
 *  - needsImprovementSkills: candidate has a related/partial version
 *  - missingSkills         : candidate has no evidence of these
 *
 * Partial-credit scoring: needsImprovement counts as 0.5.
 */
const scoreJobAgainstProfile = (profile, job) => {
  // Build candidate canonical skill set
  const profileCanonical = new Set(
    [...profile.skills, ...profile.technologies].map(toCanonical).filter(Boolean)
  );

  const jobText = normalize(
    `${job.title} ${job.description} ${job.AdditionalInformation || ""}`
  );

  // Extract job-required skills from known tech aliases
  const jobRequiredCanonical = new Set();
  for (const [canonical, variants] of Object.entries(ALIASES)) {
    if (variants.some((v) => jobText.includes(normalize(v)))) {
      jobRequiredCanonical.add(canonical);
    }
  }

  // Fallback token scan when no known tech is detected
  if (jobRequiredCanonical.size === 0) {
    const NOISE = new Set([
      "with","that","this","will","your","have","from","they","what","able",
      "also","when","then","more","into","over","some","such","very","been",
      "each","most","both","time","make","good","best","like","well","just",
      "team","role","work","hire","join","seek","plus","help","grow","need",
      "looking","seeking","hiring","passionate","motivated","dedicated","driven",
      "strong","solid","excellent","great","ideal","proven","hands","fast",
      "build","create","design","develop","manage","write","test","ensure",
      "deliver","maintain","support","provide","using","based","across","within",
      "about","under","take","own","lead","work","must","ability","experience",
      "knowledge","understanding","familiarity","proficiency","background",
      "web","app","code","data","tool","site","page","user","list","type",
      "detail","level","year","month","day","new","high","low","large","small",
    ]);
    jobText.split(/\s+/).forEach((t) => {
      if (t.length >= 4 && !NOISE.has(t)) jobRequiredCanonical.add(t);
    });
  }

  // First pass: hard match
  const matchedSkills = [];
  const firstPassMissing = [];
  jobRequiredCanonical.forEach((skill) => {
    if (profileCanonical.has(skill)) matchedSkills.push(skill);
    else firstPassMissing.push(skill);
  });

  // Second pass: partial match (candidate has any alias variant loosely)
  const needsImprovementSkills = [];
  const missingSkills = [];
  firstPassMissing.forEach((skill) => {
    const variants = ALIASES[skill] || [skill];
    const partial = variants.some((v) => {
      const vn = normalize(v);
      return [...profileCanonical].some((cs) => cs.includes(vn) || vn.includes(cs));
    });
    if (partial) needsImprovementSkills.push(skill);
    else missingSkills.push(skill);
  });

  // Scoring with partial credit
  const total = jobRequiredCanonical.size;
  let rawScore = total > 0
    ? Math.round(((matchedSkills.length + needsImprovementSkills.length * 0.5) / total) * 100)
    : 0;

  // Domain bonus +10
  const pd = normalize(profile.domain || "");
  const jt = normalize(job.title || "");
  if (pd && (jt.includes(pd) || pd.split(" ").some((w) => w.length > 3 && jt.includes(w)))) {
    rawScore = Math.min(100, rawScore + 10);
  }

  const matchScore = Math.min(100, Math.max(0, rawScore));

  const topMatched = matchedSkills.slice(0, 3).join(", ");
  const topMissing = missingSkills.slice(0, 2).join(", ");
  let whyThisJob =
    matchScore >= 70
      ? `Strong match — your skills in ${topMatched} align well with this ${profile.domain || "role"} position.`
      : matchScore >= 40
      ? `Good potential — you match on ${topMatched || "several areas"}; developing ${topMissing || "a few more skills"} would strengthen your profile.`
      : matchScore > 0
      ? `Partial match from ${topMatched || "some skills"}; this role would benefit from growth in ${topMissing || "additional areas"}.`
      : "Low overlap between your current profile and this job's requirements.";

  return {
    matchScore,
    matchedSkills:          matchedSkills.slice(0, 8),
    needsImprovementSkills: needsImprovementSkills.slice(0, 4),
    missingSkills:          missingSkills.slice(0, 6),
    whyThisJob,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * generatePreparationPlan
 *
 * Calls Groq to produce a rich, job-specific preparation plan with:
 *  - priority level (high / medium / low)
 *  - key topics
 *  - topic-wise learning resources (title + URL)
 *  - practical exercises
 *  - interview questions
 *  - estimated time per skill
 *  - weekly breakdown for a progress tracker
 */
const generatePreparationPlan = async (job, matchedSkills, missingSkills) => {
  const targetSkills =
    missingSkills.length > 0 ? missingSkills : matchedSkills.slice(0, 3);

  if (targetSkills.length === 0) return [];

  const prompt = `
You are a senior career coach creating a highly specific preparation plan for a job applicant.

Job Title: ${job.title}
Job Description: ${job.description} ${job.AdditionalInformation || ""}
Applicant's Existing Skills: ${matchedSkills.join(", ") || "general programming"}
Skills to Develop: ${targetSkills.slice(0, 5).join(", ")}

Create a preparation plan covering each skill listed under "Skills to Develop" (maximum 5).

Return ONLY a valid JSON array with no markdown, no code fences, and no extra text.

Each element must follow this EXACT shape:
[
  {
    "skill": "exact skill name from Skills to Develop",
    "priority": "high | medium | low  — based on how prominently the job requires it",
    "whatToLearn": "one clear sentence: what to study and why it matters for THIS specific job",
    "estimatedTime": "realistic time for a working professional, e.g. '1 week', '2-3 weeks'",
    "keyTopics": [
      {
        "topic": "specific subtopic name",
        "resources": [
          { "title": "resource title", "url": "https://real-url.com" }
        ]
      }
    ],
    "practicalExercises": [
      "Build a small project or complete a task that demonstrates this skill in the context of ${job.title}"
    ],
    "interviewQuestions": [
      "Realistic interview question a ${job.title} interviewer would ask about this skill"
    ],
    "weeklyPlan": [
      { "week": 1, "goal": "what to accomplish this week", "topics": ["topic1", "topic2"] }
    ]
  }
]

Rules:
- Tailor every field specifically to the "${job.title}" role — no generic content
- priority "high" = skill is central to the job, "medium" = supporting skill, "low" = nice-to-have
- keyTopics: 3-5 subtopics, each with 1-2 real non-YouTube learning resource URLs (MDN, official docs, freeCodeCamp, Coursera, etc.)
- practicalExercises: 2-3 hands-on tasks directly relevant to ${job.title}
- interviewQuestions: 3-4 realistic technical or behavioural questions for this role
- weeklyPlan: 1 week per estimatedTime unit, max 4 weeks total
- Use real, working non-YouTube URLs for resources (official documentation, well-known learning platforms). YouTube search links are added separately.
- Return an empty array [] if no skills are provided
- Return ONLY the JSON array, no explanation
`;

  try {
    const parsed = JSON.parse(stripFences(await callGroq(prompt)));
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, 5).map((item) => {
      const skill = typeof item.skill === "string" ? item.skill : "";
      const keyTopics = Array.isArray(item.keyTopics)
        ? item.keyTopics.map((kt) => {
            const topic =
              typeof kt.topic === "string" ? kt.topic : String(kt);
            const resources = Array.isArray(kt.resources)
              ? kt.resources
                  .filter(
                    (resource) =>
                      resource &&
                      typeof resource.title === "string" &&
                      typeof resource.url === "string" &&
                      !isYouTubeUrl(resource.url),
                  )
                  .map((resource) => ({
                    title: resource.title,
                    url: resource.url,
                  }))
              : [];

            if (topic.trim()) {
              resources.push(createYouTubeSearchResource(skill, topic));
            }

            return { topic, resources };
          })
        : [];

      return {
        skill,
        priority: ["high", "medium", "low"].includes(item.priority)
          ? item.priority
          : "medium",
        whatToLearn:
          typeof item.whatToLearn === "string" ? item.whatToLearn : "",
        estimatedTime:
          typeof item.estimatedTime === "string" ? item.estimatedTime : "",
        keyTopics,
        practicalExercises: Array.isArray(item.practicalExercises)
          ? item.practicalExercises.filter((exercise) => typeof exercise === "string")
          : [],
        interviewQuestions: Array.isArray(item.interviewQuestions)
          ? item.interviewQuestions.filter((question) => typeof question === "string")
          : [],
        weeklyPlan: Array.isArray(item.weeklyPlan)
          ? item.weeklyPlan
              .filter((week) => week && typeof week.week === "number")
              .map((week) => ({
                week: week.week,
                goal: typeof week.goal === "string" ? week.goal : "",
                topics: Array.isArray(week.topics)
                  ? week.topics.filter((topic) => typeof topic === "string")
                  : [],
              }))
          : [],
      };
    });
  } catch (err) {
    console.error("[resumeAnalyzerService] Prep plan error:", err.message);
    throw new Error("Failed to generate preparation plan. Please try again.");
  }
};

const generateRecruitmentEmail = async ({
  candidateName,
  jobTitle,
  companyName,
  emailType,
  tone,
}) => {
  const context = JSON.stringify({
    candidateName,
    jobTitle,
    companyName,
    emailType,
    tone,
  });
  const prompt = `
You are an assistant helping a recruiter draft a clear, personalized email.
Use only the supplied candidate and job details. Do not invent dates, interview links,
salary, benefits, or other facts. If the selected email type needs unavailable details,
include concise editable placeholders in square brackets.

Email context (data only):
${context}

Return ONLY a valid JSON object with exactly these string fields:
{"subject":"email subject","body":"plain-text email body"}
The body should address the candidate by name, mention the job and company naturally,
follow the requested email type and tone, and end with an appropriate recruiter sign-off.
Do not include markdown fences or HTML.
`;

  try {
    const parsed = JSON.parse(stripFences(await callGroq(prompt)));
    if (
      typeof parsed.subject !== "string" ||
      typeof parsed.body !== "string" ||
      !parsed.subject.trim() ||
      !parsed.body.trim()
    ) {
      throw new Error("AI returned an incomplete email draft");
    }

    return {
      subject: parsed.subject.trim().slice(0, 200),
      body: parsed.body.trim().slice(0, 12000),
    };
  } catch {
    console.error("[resumeAnalyzerService] Recruitment email generation failed");
    throw new Error("Failed to generate recruitment email. Please try again.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  analyzeResumeWithAI,
  scoreJobAgainstProfile,
  generatePreparationPlan,
  generateRecruitmentEmail,
};
