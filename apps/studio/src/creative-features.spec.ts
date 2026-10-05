import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAYGROUND_VIDEO_ID,
  UGC_SKILLS_ID,
  VIDEO_LIVRE_ID,
  creativeSkillFeatures,
  findCreativeFeature,
  isPlaygroundFeature,
} from "./creative/features";

describe("creative features (studio)", () => {
  it("expõe Vídeo livre no rail e mantém Chat fora da lista de skills", () => {
    assert.equal(findCreativeFeature(VIDEO_LIVRE_ID)?.title, "Vídeo livre");
    assert.equal(findCreativeFeature(VIDEO_LIVRE_ID)?.status, "ready");
    assert.equal(findCreativeFeature(PLAYGROUND_VIDEO_ID)?.title, "Chat");
    assert.equal(isPlaygroundFeature(PLAYGROUND_VIDEO_ID), true);
    assert.equal(isPlaygroundFeature(VIDEO_LIVRE_ID), false);
    const rail = creativeSkillFeatures("video").map((item) => item.id);
    assert.ok(rail.includes(VIDEO_LIVRE_ID));
    assert.ok(rail.includes(UGC_SKILLS_ID));
    assert.ok(!rail.includes(PLAYGROUND_VIDEO_ID));
  });
});
