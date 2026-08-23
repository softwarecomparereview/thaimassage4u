import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function ArticleDetail() {
  const [, params] = useRoute("/journal/:slug");
  const slug = params?.slug ?? "";
  const { data: article, isLoading, error } = trpc.directory.articleBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  if (isLoading) return <><SiteHeader /><main className="route-loading">Opening the guide…</main></>;
  if (error || !article) return <><SiteHeader /><main className="route-loading"><h1>This article is not currently published.</h1><Link href="/journal" className="text-link"><ArrowLeft size={16} /> Return to the journal</Link></main><SiteFooter /></>;
  return <><SiteHeader /><main className="article-detail"><Link href="/journal" className="text-link"><ArrowLeft size={16} /> The journal</Link><header><p className="eyebrow">{article.topic}</p><h1>{article.title}</h1><p>{article.excerpt}</p><span><CalendarDays size={15} />{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : "In the Quiet Hour journal"}</span></header>{article.coverImageUrl && <div className="article-cover" style={{ backgroundImage: `url(${article.coverImageUrl})` }} />}{article.body ? <article className="article-body">{article.body.split("\n\n").map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}</article> : <article className="article-body"><p>This guide is in editorial review.</p></article>}</main><SiteFooter /></>;
}
