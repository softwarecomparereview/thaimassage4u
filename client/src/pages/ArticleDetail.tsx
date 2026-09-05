import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";

/**
 * Mirrors worker/ssr.tsx's markdown() exactly (headers-as-their-own-block, [text](url) links,
 * \n as <br/> inside a paragraph) so the client's hydrated output matches what the server
 * rendered for crawlers — a mismatch here is a real hydration bug, not just a style difference.
 */
function renderInlineLinks(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<a key={`${keyPrefix}-${index++}`} href={match[2]}>{match[1]}</a>);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderArticleBody(body: string) {
  return body.split(/\n{2,}/).map((block, blockIndex) => {
    const heading = block.match(/^(#{1,3}) ([\s\S]+)$/);
    const content = (heading ? heading[2] : block).split("\n").flatMap((line, lineIndex, lines) => {
      const rendered = renderInlineLinks(line, `b${blockIndex}-l${lineIndex}`);
      return lineIndex < lines.length - 1 ? [...rendered, <br key={`b${blockIndex}-br${lineIndex}`} />] : rendered;
    });
    if (heading?.[1] === "#") return <h1 key={blockIndex}>{content}</h1>;
    if (heading?.[1] === "##") return <h2 key={blockIndex}>{content}</h2>;
    if (heading?.[1] === "###") return <h3 key={blockIndex}>{content}</h3>;
    return <p key={blockIndex}>{content}</p>;
  });
}

export default function ArticleDetail() {
  const [, params] = useRoute("/journal/:slug");
  const slug = params?.slug ?? "";
  const { data: article, isLoading, error } = trpc.directory.articleBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  if (isLoading) return <><SiteHeader /><main className="route-loading">Opening the guide…</main></>;
  if (error || !article) return <><SiteHeader /><main className="route-loading"><h1>This article is not currently published.</h1><Link href="/journal" className="text-link"><ArrowLeft size={16} /> Return to the journal</Link></main><SiteFooter /></>;
  return <><SiteHeader /><main className="article-detail"><Link href="/journal" className="text-link"><ArrowLeft size={16} /> The journal</Link><header><p className="eyebrow">{article.topic}</p><h1>{article.title}</h1><p>{article.excerpt}</p><span><CalendarDays size={15} />{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : "In the Quiet Hour journal"}</span></header>{article.coverImageUrl && <div className="article-cover" style={{ backgroundImage: `url(${article.coverImageUrl})` }} />}{article.body ? <article className="article-body">{renderArticleBody(article.body)}</article> : <article className="article-body"><p>This guide is in editorial review.</p></article>}</main><SiteFooter /></>;
}
