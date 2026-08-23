import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Link } from "wouter";

const defaultTopics = ["Mindfulness", "Massage", "Circulation"];

export default function Journal() {
  const { data, isLoading } = trpc.directory.home.useQuery();
  const articles = data?.articles ?? [];
  return <><SiteHeader /><main>
    <PageIntro eyebrow="Quiet Hour / the journal" title="Wellness intelligence, without the performance." description="Clear, practical pieces for feeling better in your body and finding a little more room in your day." />
    <section className="journal-topic-row">{Array.from(new Set<string>([...articles.map((article: any) => article.topic), ...defaultTopics])).map(topic => <span key={topic}>{topic}</span>)}</section>
    <section className="journal-grid">
      {isLoading && <p className="loading-copy">Opening the journal…</p>}
      {!isLoading && articles.map((article: any, index: number) => <Link href={`/journal/${article.slug}`} className={`journal-story story-${index % 3}`} key={article.id}><div className="journal-story__image" style={article.coverImageUrl ? { backgroundImage: `url(${article.coverImageUrl})` } : undefined}><span>{article.topic}</span></div><div><p className="eyebrow">{article.topic}</p><h2>{article.title}</h2><p>{article.excerpt || "A considered guide from the Quiet Hour desk."}</p><span className="story-read"><Clock3 size={15} /> Read the guide <ArrowUpRight size={15} /></span></div></Link>)}
      {!isLoading && articles.length === 0 && <div className="journal-empty"><p className="eyebrow">Editorial desk</p><h2>The first essays are in review.</h2><p>We publish fewer pieces, with a little more use in every one.</p></div>}
    </section>
  </main><SiteFooter /></>;
}
