import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EditDocumentStore,
  createEmptyEditDocument,
  recomputeDuration,
} from "./document";
import { buildExportPlan } from "./export-graph";

describe("EditDocumentStore", () => {
  it("adds media and clips then recomputes duration", () => {
    const store = new EditDocumentStore();
    store.loadProject("p1", "Teste", createEmptyEditDocument());
    const mediaId = store.addMediaToLibrary({
      kind: "video",
      localPath: "storage/video-projects/a/b.mp4",
      mimeType: "video/mp4",
      label: "Clip A",
    });
    store.addClipFromMedia(mediaId, { durationMs: 4000 });
    const doc = store.getState().document;
    assert.equal(doc.durationMs, 4000);
    assert.equal(doc.tracks.find((t) => t.type === "video")?.clips.length, 1);
  });

  it("splits selected clip at playhead", () => {
    const store = new EditDocumentStore();
    store.loadProject("p1", "Teste", createEmptyEditDocument());
    const mediaId = store.addMediaToLibrary({
      kind: "video",
      localPath: "storage/x.mp4",
      mimeType: "video/mp4",
    });
    store.addClipFromMedia(mediaId, { durationMs: 5000, startMs: 0 });
    const track = store.getState().document.tracks.find((t) => t.type === "video")!;
    const clipId = track.clips[0].id;
    store.select(track.id, clipId);
    store.setPlayhead(2000);
    store.splitClipAtPlayhead();
    const clips = store.getState().document.tracks.find((t) => t.type === "video")!
      .clips;
    assert.equal(clips.length, 2);
    assert.equal(clips[0].durationMs, 2000);
    assert.equal(clips[1].startMs, 2000);
    assert.equal(clips[1].durationMs, 3000);
  });

  it("supports undo after clip remove", () => {
    const store = new EditDocumentStore();
    store.loadProject("p1", "Teste", createEmptyEditDocument());
    const mediaId = store.addMediaToLibrary({
      kind: "audio",
      localPath: "storage/a.mp3",
      mimeType: "audio/mpeg",
    });
    store.addClipFromMedia(mediaId, { durationMs: 2000 });
    const track = store.getState().document.tracks.find((t) => t.type === "audio")!;
    const clipId = track.clips[0].id;
    store.removeClip(track.id, clipId);
    assert.equal(
      store.getState().document.tracks.find((t) => t.type === "audio")?.clips
        .length,
      0,
    );
    store.undo();
    assert.equal(
      store.getState().document.tracks.find((t) => t.type === "audio")?.clips
        .length,
      1,
    );
  });
});

describe("recomputeDuration", () => {
  it("uses max clip end", () => {
    const doc = createEmptyEditDocument();
    doc.tracks[0].clips.push({
      id: "c1",
      mediaId: "m1",
      media: {
        kind: "video",
        localPath: "storage/a.mp4",
        mimeType: "video/mp4",
      },
      startMs: 1000,
      durationMs: 3000,
      inMs: 0,
      outMs: 3000,
      volume: 1,
      muted: false,
    });
    assert.equal(recomputeDuration(doc), 4000);
  });
});

describe("buildExportPlan", () => {
  it("maps inputs and outputs mp4 args", () => {
    const doc = createEmptyEditDocument();
    doc.durationMs = 5000;
    doc.tracks[0].clips.push({
      id: "c1",
      mediaId: "m1",
      media: {
        kind: "video",
        localPath: "storage/video-projects/p/a.mp4",
        mimeType: "video/mp4",
        label: "A",
      },
      startMs: 0,
      durationMs: 5000,
      inMs: 0,
      outMs: 5000,
      volume: 1,
      muted: false,
      transform: { x: 0, y: 0, scale: 1, fit: "contain" },
    });
    const plan = buildExportPlan(doc, "9:16");
    assert.ok(plan.inputs.length >= 1);
    assert.ok(plan.args.includes("out.mp4"));
    assert.ok(plan.args.includes("libx264"));
    assert.ok(plan.args.includes("-filter_complex"));
  });

  it("turns a text clip into a png overlay without drawtext", () => {
    const store = new EditDocumentStore();
    store.loadProject("p1", "Teste", createEmptyEditDocument());
    store.addTextClip("Olá");
    const doc = store.getState().document;
    const overlay = doc.tracks.find((t) => t.type === "overlay");
    assert.equal(overlay?.clips.length, 1);
    assert.equal(overlay?.clips[0].media.kind, "text");
    assert.equal(overlay?.clips[0].text?.fontId, "classic");
    const plan = buildExportPlan(doc, "9:16");
    const filter = String(plan.args[plan.args.indexOf("-filter_complex") + 1]);
    assert.equal(filter.includes("drawtext"), false);
    assert.ok(plan.inputs.some((input) => input.rasterClipId && input.mimeType === "image/png"));
    assert.ok(filter.includes("overlay=0:0"));
  });
});
