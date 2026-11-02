// Run: node --test tests/
import { test } from "node:test"
import assert from "node:assert/strict"
import { MAX_RESULTS, matchRank, searchProjects } from "../src/lib/project-search.ts"

const p = (...codes: string[]) => codes.map(code => ({ code }))
const codes = (r: { code: string }[]) => r.map(x => x.code)

test("ranks exact, then prefix, then substring; ties keep list order", () => {
  const r = searchProjects(p("X-4821", "4821-B", "PRJ-4821", "4821", "4821-A"), "4821")
  assert.deepEqual(codes(r), ["4821", "4821-B", "4821-A", "X-4821", "PRJ-4821"])
})

test("preserves leading zeros and formatting; no numeric coercion", () => {
  const items = p("00123", "123", "0123")
  assert.deepEqual(codes(searchProjects(items, "0012")), ["00123"])
  assert.deepEqual(codes(searchProjects(items, "123")), ["123", "00123", "0123"])
})

test("trims whitespace and ignores case", () => {
  assert.deepEqual(codes(searchProjects(p("PRJ-4821", "de-ops"), "  de-OPS ")), ["de-ops"])
})

test("blank query returns nothing; no match returns nothing", () => {
  assert.deepEqual(searchProjects(p("A1"), "   "), [])
  assert.deepEqual(searchProjects(p("A1"), "zz"), [])
  assert.equal(matchRank("A1", ""), -1)
})

test("does not mutate its input", () => {
  const items = p("b2", "a2")
  searchProjects(items, "2")
  assert.deepEqual(codes(items), ["b2", "a2"])
})

test("stays fast and complete on a large list", () => {
  const items = p(...Array.from({ length: 20000 }, (_, i) => `PRJ-${String(i).padStart(5, "0")}`))
  const t = performance.now()
  const r = searchProjects(items, "PRJ-0042")
  assert.ok(performance.now() - t < 100)
  assert.equal(r[0].code, "PRJ-00420")
  assert.equal(r.length, 10)
  assert.ok(searchProjects(items, "00").length > MAX_RESULTS)
  assert.equal(codes(searchProjects(items, "19999"))[0], "PRJ-19999")
})
