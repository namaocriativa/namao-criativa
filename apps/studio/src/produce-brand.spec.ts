import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultProduceBrandFlags,
  produceBrandPayload,
} from "./produce-brand";

describe("produce-brand", () => {
  it("liga identidade por padrão quando há dados úteis e mantém logo desligado", () => {
    assert.deepEqual(
      defaultProduceBrandFlags({
        primaryColor: "#112233",
        logoImageId: "img-1",
        logoAppearance: "canto",
      }),
      {
        useBrandIdentity: true,
        useBrandLogo: false,
        logoAppearance: "",
      },
    );
  });

  it("não liga identidade sem dados úteis", () => {
    assert.deepEqual(defaultProduceBrandFlags({}), {
      useBrandIdentity: false,
      useBrandLogo: false,
      logoAppearance: "",
    });
  });

  it("monta payload só com flags ativas", () => {
    assert.deepEqual(
      produceBrandPayload({
        useBrandIdentity: true,
        useBrandLogo: false,
        logoAppearance: "x",
      }),
      { useBrandIdentity: true },
    );
    assert.deepEqual(
      produceBrandPayload({
        useBrandIdentity: false,
        useBrandLogo: true,
        logoAppearance: "canto inferior",
      }),
      {
        useBrandLogo: true,
        logoAppearance: "canto inferior",
      },
    );
  });
});
