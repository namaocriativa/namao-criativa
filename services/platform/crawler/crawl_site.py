#!/usr/bin/env python3
"""Crawl a business website with Crawl4AI and print JSON for the NestJS provider."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

RELEVANT = (
    "contato",
    "contact",
    "sobre",
    "about",
    "servico",
    "service",
    "quem-somos",
)
MAX_HTML_CHARS = 1_500_000


def serialize_page(result: Any) -> dict[str, Any]:
    markdown = result.markdown
    raw_md = ""
    fit_md = None
    if markdown is None:
        raw_md = ""
    elif isinstance(markdown, str):
        raw_md = markdown
    else:
        raw_md = getattr(markdown, "raw_markdown", "") or ""
        fit_md = getattr(markdown, "fit_markdown", None)

    html = result.html or result.cleaned_html or ""
    if len(html) > MAX_HTML_CHARS:
        html = html[:MAX_HTML_CHARS]

    return {
        "url": result.url,
        "html": html,
        "cleanedHtml": (result.cleaned_html or "")[:MAX_HTML_CHARS] or None,
        "markdown": raw_md[:200_000],
        "fitMarkdown": (fit_md[:200_000] if isinstance(fit_md, str) else None),
        "metadata": result.metadata or {},
        "media": result.media or {},
        "links": result.links or {},
        "success": bool(result.success),
        "statusCode": result.status_code,
        "error": result.error_message,
    }


def pick_relevant_links(result: Any, origin: str, limit: int) -> list[str]:
    found: list[str] = []
    seen: set[str] = {origin.rstrip("/")}
    internal = (result.links or {}).get("internal") or []
    for link in internal:
        href = link.get("href") if isinstance(link, dict) else None
        if not href:
            continue
        parsed = urlparse(href)
        if parsed.netloc and urlparse(origin).netloc and parsed.netloc != urlparse(origin).netloc:
            continue
        path = (parsed.path or "").lower()
        if not any(token in path for token in RELEVANT):
            continue
        url = href.split("#")[0].split("?")[0]
        key = url.rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        found.append(url)
        if len(found) >= limit:
            break
    return found


async def crawl(url: str, max_pages: int) -> dict[str, Any]:
    browser = BrowserConfig(headless=True, verbose=False)
    run = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=5,
        exclude_external_links=True,
        process_iframes=True,
        remove_overlay_elements=True,
        page_timeout=25_000,
    )

    pages: list[dict[str, Any]] = []
    async with AsyncWebCrawler(config=browser) as crawler:
        home = await crawler.arun(url=url, config=run)
        if not home.success:
            return {
                "ok": False,
                "error": home.error_message or "Crawl da homepage falhou",
                "pages": [],
            }
        pages.append(serialize_page(home))

        extra = pick_relevant_links(home, url, max(0, max_pages - 1))
        if extra:
            extras = await crawler.arun_many(extra, config=run)
            if hasattr(extras, "__aiter__") and not isinstance(extras, (list, tuple)):
                collected = []
                async for result in extras:
                    collected.append(result)
                extras = collected
            for result in extras:
                if result.success:
                    pages.append(serialize_page(result))

    return {"ok": True, "pages": pages}


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl a site with Crawl4AI")
    parser.add_argument("url")
    parser.add_argument("--max-pages", type=int, default=6)
    args = parser.parse_args()

    try:
        payload = asyncio.run(crawl(args.url, args.max_pages))
    except Exception as exc:  # noqa: BLE001
        payload = {"ok": False, "error": str(exc), "pages": []}

    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
