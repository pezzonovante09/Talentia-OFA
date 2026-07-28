import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_curriculum_audit_canvas_data.json'), 'utf8'),
);
const dataLiteral = JSON.stringify(data);

const tsx = `import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  Toggle,
  Button,
  useCanvasState,
} from "cursor/canvas";

type Problem = { ref: string; issue: string };
type Lesson = {
  id: string;
  grade: string;
  subject: string;
  world: string;
  title: string;
  c: number;
  u: number;
  e: number;
  d: number;
  sum: number;
  verdict: string;
  problems: Problem[];
  fixes: string[];
  enky: string[];
  aba: boolean;
  pureMc: boolean;
};

type AuditData = {
  meta: {
    generatedAt: string;
    lessonCount: number;
    averages: {
      coherence: number;
      usefulness: number;
      engagement: number;
      diversity: number;
    };
    pureMcCount: number;
    enkyIssueCount: number;
    abaDiffCount: number;
    criticalCount: number;
    scope: string;
  };
  top5: Array<{
    id: string;
    title: string;
    grade: string | number;
    sum: number;
    coherence: number;
    usefulness: number;
    engagement: number;
    diversity: number;
    verdict: string;
    problems: Problem[];
    fixes: string[];
  }>;
  templates: Array<{
    name: string;
    count: number;
    note?: string;
    lessons: string[];
  }>;
  systemic: Array<{
    id: string;
    title: string;
    detail: string;
    evidence: string[];
  }>;
  lessons: Lesson[];
};

const DATA: AuditData = ${dataLiteral};

const SUBJECT_LABEL: Record<string, string> = {
  math: "Math",
  reading_ru: "Russian",
  reading: "English",
  logic: "World / Logic",
  social: "Social",
  unknown: "Other",
};

function scoreTone(n: number): "success" | "warning" | "info" | "neutral" {
  if (n >= 4) return "success";
  if (n === 3) return "warning";
  if (n <= 2) return "info";
  return "neutral";
}

function LessonDetail({ lesson }: { lesson: Lesson }) {
  return (
    <Stack gap={8}>
      <Row gap={8} wrap>
        <Pill tone={scoreTone(lesson.c)} size="sm">
          Coherence {lesson.c}
        </Pill>
        <Pill tone={scoreTone(lesson.u)} size="sm">
          Usefulness {lesson.u}
        </Pill>
        <Pill tone={scoreTone(lesson.e)} size="sm">
          Engagement {lesson.e}
        </Pill>
        <Pill tone={scoreTone(lesson.d)} size="sm">
          Diversity {lesson.d}
        </Pill>
        {lesson.pureMc ? (
          <Pill tone="warning" size="sm">
            MC-only
          </Pill>
        ) : null}
        {lesson.enky.length ? (
          <Pill tone="warning" size="sm">
            EN/KY flags
          </Pill>
        ) : null}
        {lesson.aba ? <Pill size="sm">ABA diff</Pill> : null}
      </Row>
      <Text tone="secondary" size="small">
        {lesson.world} · {SUBJECT_LABEL[lesson.subject] || lesson.subject} · grade{" "}
        {lesson.grade} · sum {lesson.sum}/20 · {lesson.verdict}
      </Text>
      {lesson.problems.length ? (
        <Stack gap={4}>
          <Text weight="semibold" size="small">
            Problems
          </Text>
          <Text size="small">
            {lesson.problems.map((p) => p.ref + " — " + p.issue).join("\\n")}
          </Text>
        </Stack>
      ) : null}
      {lesson.fixes.length ? (
        <Stack gap={4}>
          <Text weight="semibold" size="small">
            Fixes
          </Text>
          <Text size="small">
            {lesson.fixes.map((f) => "• " + f).join("\\n")}
          </Text>
        </Stack>
      ) : null}
      {lesson.enky.length ? (
        <Text size="small" tone="secondary">
          EN/KY: {lesson.enky.join(" · ")}
        </Text>
      ) : null}
      <Text size="small" tone="tertiary" style={{ fontFamily: "monospace" }}>
        curricula/grade-*-curriculum-ru.md · {lesson.id} · src/data/worlds.ts ·
        locales ru/en/ky.json
      </Text>
    </Stack>
  );
}

export default function CurriculumContentAudit() {
  const [grade, setGrade] = useCanvasState("grade", "all");
  const [subject, setSubject] = useCanvasState("subject", "all");
  const [minScore, setMinScore] = useCanvasState("minScore", "1");
  const [maxSum, setMaxSum] = useCanvasState("maxSum", "20");
  const [enkyOnly, setEnkyOnly] = useCanvasState("enkyOnly", false);
  const [abaOnly, setAbaOnly] = useCanvasState("abaOnly", false);
  const [mcOnly, setMcOnly] = useCanvasState("mcOnly", false);
  const [query, setQuery] = useCanvasState("query", "");
  const [selectedId, setSelectedId] = useCanvasState(
    "selectedId",
    DATA.top5[0]?.id || "",
  );

  const filtered = DATA.lessons.filter((l) => {
    if (grade !== "all" && String(l.grade) !== grade) return false;
    if (subject !== "all" && l.subject !== subject) return false;
    const floor = Number(minScore) || 1;
    if (floor > 1) {
      const m = Math.min(l.c, l.u, l.e, l.d);
      if (m < floor) return false;
    }
    const cap = Number(maxSum) || 20;
    if (l.sum > cap) return false;
    if (enkyOnly && !l.enky.length) return false;
    if (abaOnly && !l.aba) return false;
    if (mcOnly && !l.pureMc) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const blob = (l.id + " " + l.title + " " + l.world + " " + l.verdict).toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => a.sum - b.sum || a.id.localeCompare(b.id),
  );
  const selected = DATA.lessons.find((l) => l.id === selectedId) || sorted[0];
  const avg = DATA.meta.averages;

  return (
    <Stack gap={20} style={{ padding: 20 }}>
      <Stack gap={6}>
        <H1>Talentia curriculum re-audit</H1>
        <Text tone="secondary">
          {DATA.meta.lessonCount} lessons · after Phases 1–7 · standard RU · ABA
          where overrides differ · EN/KY flags
        </Text>
        <Text size="small" tone="tertiary">
          Source: worlds.ts + curricula/*.md + locales · {DATA.meta.generatedAt}
        </Text>
      </Stack>

      {DATA.meta.before ? (
        <Callout
          tone="success"
          title={
            "Before → After: C " +
            DATA.meta.before.averages.coherence +
            "→" +
            avg.coherence +
            " · U " +
            DATA.meta.before.averages.usefulness +
            "→" +
            avg.usefulness +
            " · E " +
            DATA.meta.before.averages.engagement +
            "→" +
            avg.engagement +
            " · D " +
            DATA.meta.before.averages.diversity +
            "→" +
            avg.diversity +
            " · pureMC " +
            DATA.meta.before.pureMcCount +
            "→" +
            DATA.meta.pureMcCount +
            " · critical " +
            DATA.meta.before.criticalCount +
            "→" +
            DATA.meta.criticalCount +
            (DATA.delta
              ? " · improved≥2sum " + DATA.delta.improvedCount
              : "")
          }
        >
          Re-audit vs baseline _curriculum_audit_merged.before.json. Remaining
          gap: coherence under 4 on{" "}
          {String(DATA.meta.coherenceBelow4 ?? "?")} lessons; diversity still
          the weakest axis (mostly MC+input).
        </Callout>
      ) : null}

      <Grid columns={4} gap={12}>
        <Stat value={String(avg.coherence)} label="Avg coherence" />
        <Stat value={String(avg.usefulness)} label="Avg usefulness" />
        <Stat value={String(avg.engagement)} label="Avg engagement" />
        <Stat
          value={String(avg.diversity)}
          label="Avg diversity"
          tone={avg.diversity < 3 ? "warning" : "success"}
        />
      </Grid>

      <Grid columns={4} gap={12}>
        <Stat
          value={String(DATA.meta.criticalCount)}
          label="Critical (C/U≤2 or key bugs)"
          tone={DATA.meta.criticalCount > 0 ? "warning" : "success"}
        />
        <Stat
          value={String(DATA.meta.pureMcCount)}
          label="MC-only lessons"
          tone={DATA.meta.pureMcCount === 0 ? "success" : "warning"}
        />
        <Stat
          value={String(DATA.meta.enkyIssueCount)}
          label="EN/KY flagged"
          tone="warning"
        />
        <Stat
          value={String(DATA.meta.coherenceBelow4 ?? "—")}
          label="Coherence &lt; 4"
        />
      </Grid>

      <H2>Top 5 weakest lessons</H2>
      <Table
        headers={["#", "Lesson", "Scores", "Verdict", "Main problem"]}
        rows={DATA.top5.map((w, idx) => [
          String(idx + 1),
          w.id + " — " + w.title,
          "C" +
            w.coherence +
            " U" +
            w.usefulness +
            " E" +
            w.engagement +
            " D" +
            w.diversity +
            " sum " +
            w.sum,
          w.verdict,
          (w.problems || [])[0]
            ? (w.problems || [])[0].ref + ": " + (w.problems || [])[0].issue
            : "",
        ])}
        rowTone={DATA.top5.map(() => "danger" as const)}
      />
      <Row gap={8} wrap>
        <Button variant="secondary" onClick={() => setSelectedId(DATA.top5[0].id)}>
          {DATA.top5[0].id}
        </Button>
        <Button variant="secondary" onClick={() => setSelectedId(DATA.top5[1].id)}>
          {DATA.top5[1].id}
        </Button>
        <Button variant="secondary" onClick={() => setSelectedId(DATA.top5[2].id)}>
          {DATA.top5[2].id}
        </Button>
        <Button variant="secondary" onClick={() => setSelectedId(DATA.top5[3].id)}>
          {DATA.top5[3].id}
        </Button>
        <Button variant="secondary" onClick={() => setSelectedId(DATA.top5[4].id)}>
          {DATA.top5[4].id}
        </Button>
      </Row>

      <H2>Most frequent task templates</H2>
      <Table
        headers={["Template", "Lessons", "Examples"]}
        rows={DATA.templates.map((t) => [
          t.name,
          String(t.count),
          t.lessons.slice(0, 4).join(", "),
        ])}
      />

      <H2>Systemic problems</H2>
      <Table
        headers={["Status", "Problem", "Detail", "Evidence"]}
        rows={DATA.systemic.map((s) => [
          s.status || "open",
          s.title,
          s.detail,
          (s.evidence || []).slice(0, 4).join(", "),
        ])}
      />

      <Divider />
      <H2>All lessons</H2>
      <Row gap={10} wrap align="end">
        <Stack gap={4} style={{ minWidth: 140 }}>
          <Text size="small" tone="secondary">
            Grade
          </Text>
          <Select
            value={grade}
            onChange={setGrade}
            options={[
              { value: "all", label: "All grades" },
              { value: "0", label: "0 (5-6)" },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
              { value: "legacy", label: "Legacy" },
            ]}
          />
        </Stack>
        <Stack gap={4} style={{ minWidth: 160 }}>
          <Text size="small" tone="secondary">
            Subject
          </Text>
          <Select
            value={subject}
            onChange={setSubject}
            options={[
              { value: "all", label: "All subjects" },
              { value: "math", label: "Math" },
              { value: "reading_ru", label: "Russian" },
              { value: "reading", label: "English" },
              { value: "logic", label: "World / Logic" },
              { value: "social", label: "Social" },
            ]}
          />
        </Stack>
        <Stack gap={4} style={{ minWidth: 120 }}>
          <Text size="small" tone="secondary">
            Min of 4 scores
          </Text>
          <Select
            value={minScore}
            onChange={setMinScore}
            options={[
              { value: "1", label: "Any" },
              { value: "2", label: "at least 2" },
              { value: "3", label: "at least 3" },
              { value: "4", label: "at least 4" },
            ]}
          />
        </Stack>
        <Stack gap={4} style={{ minWidth: 140 }}>
          <Text size="small" tone="secondary">
            Max sum (weak filter)
          </Text>
          <Select
            value={maxSum}
            onChange={setMaxSum}
            options={[
              { value: "20", label: "All" },
              { value: "8", label: "sum <= 8" },
              { value: "10", label: "sum <= 10" },
              { value: "12", label: "sum <= 12" },
              { value: "16", label: "sum <= 16" },
            ]}
          />
        </Stack>
        <Stack gap={4} style={{ minWidth: 200, flex: 1 }}>
          <Text size="small" tone="secondary">
            Search id / title
          </Text>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="e.g. g1w-bdy or Zdorovye"
          />
        </Stack>
      </Row>
      <Row gap={16} wrap align="center">
        <Row gap={8} align="center">
          <Text size="small">EN/KY issues</Text>
          <Toggle checked={enkyOnly} onChange={setEnkyOnly} />
        </Row>
        <Row gap={8} align="center">
          <Text size="small">ABA differs</Text>
          <Toggle checked={abaOnly} onChange={setAbaOnly} />
        </Row>
        <Row gap={8} align="center">
          <Text size="small">MC-only</Text>
          <Toggle checked={mcOnly} onChange={setMcOnly} />
        </Row>
      </Row>
      <Text size="small" tone="secondary">
        {sorted.length} lessons match filters
      </Text>

      <Stack gap={4} style={{ maxWidth: 480 }}>
        <Text size="small" tone="secondary">
          Open lesson detail
        </Text>
        <Select
          value={selected?.id || ""}
          onChange={setSelectedId}
          options={sorted.slice(0, 120).map((l) => ({
            value: l.id,
            label: l.sum + "/20 · " + l.id + " — " + l.title,
          }))}
        />
      </Stack>

      <H3>Lesson table (weakest first)</H3>
      <Table
        headers={["Lesson", "Title", "G", "C", "U", "E", "D", "Sum"]}
        rows={sorted.slice(0, 80).map((l) => [
          l.id,
          l.title,
          String(l.grade),
          String(l.c),
          String(l.u),
          String(l.e),
          String(l.d),
          String(l.sum),
        ])}
        rowTone={sorted
          .slice(0, 80)
          .map((l) =>
            l.sum <= 8 ? "danger" : l.sum <= 12 ? "warning" : undefined,
          )}
        striped
        stickyHeader
      />
      {sorted.length > 80 ? (
        <Text size="small" tone="tertiary">
          Showing first 80 of {sorted.length}. Tighten filters to narrow.
        </Text>
      ) : null}

      <Card>
        <CardHeader>{selected ? selected.id : "Select a lesson"}</CardHeader>
        <CardBody>
          {selected ? (
            <Stack gap={8}>
              <H3>{selected.title}</H3>
              <LessonDetail lesson={selected} />
            </Stack>
          ) : (
            <Text tone="secondary">
              Pick a lesson in the select above to see problems and fixes.
            </Text>
          )}
        </CardBody>
      </Card>

      <Text size="small" tone="tertiary">
        Scores 1-5: coherence (dialog to intro to tasks), usefulness (skill +
        age), engagement, diversity (mechanics). Recommendations only — no code
        edits in this audit.
      </Text>
    </Stack>
  );
}
`;

const outPath = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-User-Desktop-Talentia-v1-0",
  "canvases",
  "curriculum-content-audit.canvas.tsx",
);
fs.writeFileSync(outPath, tsx);
console.log("wrote", outPath, "bytes", fs.statSync(outPath).size);
