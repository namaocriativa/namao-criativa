import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatChatMarkdown } from "./chat-markdown";

describe("formatChatMarkdown", () => {
  it("escapa HTML", () => {
    assert.equal(
      formatChatMarkdown('<script>alert("x")</script>'),
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("transforma negrito e listas markdown", () => {
    const html = formatChatMarkdown(
      "Veja as opções:\n\n- **Frescura:** gotas d'água\n- Preparação",
    );
    assert.match(html, /<p>Veja as opções:<\/p>/);
    assert.match(html, /<ul><li><strong>Frescura:<\/strong> gotas d'água<\/li>/);
    assert.match(html, /<li>Preparação<\/li><\/ul>/);
  });

  it("quebra bullets colados no mesmo parágrafo", () => {
    const html = formatChatMarkdown(
      "Por exemplo: * **Foco na frescura:** Frutas lavadas. * **Preparação:** Frutas cortadas. Me diga o tema.",
    );
    assert.match(html, /<p>Por exemplo:<\/p>/);
    assert.match(html, /<li><strong>Foco na frescura:<\/strong> Frutas lavadas.<\/li>/);
    assert.match(html, /<li><strong>Preparação:<\/strong> Frutas cortadas. Me diga o tema.<\/li>/);
  });
});
