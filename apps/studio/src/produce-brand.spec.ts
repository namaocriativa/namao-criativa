import { describe, expect, it } from "vitest";
import {
  defaultProduceBrandFlags,
  produceBrandPayload,
} from "./produce-brand";

describe("produce-brand", () => {
  it("liga identidade por padrão quando há dados úteis e mantém logo desligado", () => {
    expect(
      defaultProduceBrandFlags({
        primaryColor: "#112233",
        logoImageId: "img-1",
        logoAppearance: "canto",
      }),
    ).toEqual({
      useBrandIdentity: true,
      useBrandLogo: false,
      logoAppearance: "",
    });
  });

  it("não liga identidade sem dados úteis", () => {
    expect(defaultProduceBrandFlags({})).toEqual({
      useBrandIdentity: false,
      useBrandLogo: false,
      logoAppearance: "",
    });
  });

  it("monta payload só com flags ativas", () => {
    expect(
      produceBrandPayload({
        useBrandIdentity: true,
        useBrandLogo: false,
        logoAppearance: "x",
      }),
    ).toEqual({ useBrandIdentity: true });
    expect(
      produceBrandPayload({
        useBrandIdentity: false,
        useBrandLogo: true,
        logoAppearance: "canto inferior",
      }),
    ).toEqual({
      useBrandLogo: true,
      logoAppearance: "canto inferior",
    });
  });
});
