import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { COUNTRIES } from "@/lib/country";
import { ArrowUpRight, PackageOpen, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";

type Offer = { id: number; title: string; price: number; shipping: number | null; total: number; currency: string; freeShipping: boolean; url: string; image: string | null; supplier: string };
type Category = { key: string; label: string; compareUrl: string | null; amazonUrl: string | null; offers: Offer[] };
type SuppliesPayload = { country: string; updatedAt: string | null; categories: Category[] };

const SYMBOLS: Record<string, string> = { USD: "$", AUD: "A$", GBP: "£", EUR: "€", CAD: "C$", NZD: "NZ$", AED: "AED " };

/**
 * Owner-facing i18n: 28% of listings carry explicit Thai name markers and the
 * sector is heavily Thai-diaspora-owned, with Chinese tui-na shops the second
 * cluster — so the page owners actually buy from speaks their languages.
 * Consumer pages stay English/German (that's what searchers type).
 */
type Lang = "en" | "th" | "zh";
const LANGS: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "English" },
  { code: "th", label: "ไทย" },
  { code: "zh", label: "中文" },
];
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    eyebrow: "For studio owners",
    heading: "Today's cheapest supplies, delivered locally.",
    intro: "Re-checked daily across the essentials a massage business actually re-buys — sorted by total price with delivery included. Pick your country:",
    freeDelivery: "free delivery",
    inclDelivery: "incl.",
    compare: "Compare on AliExpress",
    amazon: "Compare on Amazon",
    more: "Also worth comparing.",
    empty: "Today's scan hasn't landed for this country yet.",
    emptyHint: "Prices refresh daily — check back shortly.",
    disclosure: "Prices are re-checked daily from public marketplace listings and include delivery where shown; final prices are set by each seller. Some outbound links are affiliate links — buying through them supports the directory at no cost to you.",
    "sheets": "Massage table sheets & covers", "oil": "Massage oil (bulk)", "towels": "Towels (bulk)", "face-cradle": "Face cradle covers", "massage-gun": "Massage guns", "hot-stones": "Hot stone sets",
  },
  th: {
    eyebrow: "สำหรับเจ้าของร้าน",
    heading: "อุปกรณ์ร้านนวดราคาถูกที่สุดวันนี้ ส่งถึงที่",
    intro: "ตรวจสอบราคาใหม่ทุกวัน สำหรับของใช้ที่ร้านนวดต้องซื้อประจำ — เรียงตามราคารวมค่าส่ง เลือกประเทศของคุณ:",
    freeDelivery: "ส่งฟรี",
    inclDelivery: "รวมค่าส่ง",
    compare: "เปรียบเทียบราคาบน AliExpress",
    amazon: "เปรียบเทียบราคาบน Amazon",
    more: "หมวดอื่นที่น่าเปรียบเทียบ",
    empty: "ยังไม่มีข้อมูลราคาของวันนี้สำหรับประเทศนี้",
    emptyHint: "ราคาอัปเดตทุกวัน — กลับมาดูอีกครั้งเร็วๆ นี้",
    disclosure: "ราคาตรวจสอบใหม่ทุกวันจากประกาศขายสาธารณะ และรวมค่าส่งตามที่แสดง ราคาสุดท้ายขึ้นอยู่กับผู้ขายแต่ละราย ลิงก์บางส่วนเป็นลิงก์พันธมิตร — การซื้อผ่านลิงก์ช่วยสนับสนุนไดเรกทอรีโดยคุณไม่ต้องจ่ายเพิ่ม",
    "sheets": "ผ้าปูเตียงนวดและผ้าคลุม", "oil": "น้ำมันนวด (ขายส่ง)", "towels": "ผ้าขนหนู (ขายส่ง)", "face-cradle": "ผ้ารองเบาะหน้า", "massage-gun": "ปืนนวด", "hot-stones": "ชุดหินร้อน",
  },
  zh: {
    eyebrow: "店主专区",
    heading: "今日最低价按摩用品，本地配送",
    intro: "每天重新核对按摩店常购必需品的价格 — 按含运费总价排序。选择您的国家：",
    freeDelivery: "免运费",
    inclDelivery: "含运费",
    compare: "在全球速卖通比价",
    amazon: "在亚马逊比价",
    more: "其他值得比较的品类",
    empty: "今天该国家的价格数据尚未更新",
    emptyHint: "价格每日刷新 — 请稍后再来",
    disclosure: "价格每日从公开市场信息重新核对，显示的价格含运费；最终价格以卖家为准。部分链接为联盟链接 — 通过链接购买将支持本目录，您无需支付额外费用。",
    "sheets": "按摩床单和床罩", "oil": "按摩油（批发）", "towels": "毛巾（批发）", "face-cradle": "洗脸垫巾", "massage-gun": "筋膜枪", "hot-stones": "热石套装",
  },
};

function money(value: number, currency: string) {
  return `${SYMBOLS[currency] ?? ""}${value.toFixed(2)}`;
}

/**
 * Daily-refreshed cheapest supplies per country, for the businesses listed in
 * the directory. Offers come from /api/supplies (see worker/supplies.ts);
 * some outbound links are affiliate links, disclosed below the list.
 */
export default function Supplies() {
  const search = useSearch();
  const [, params] = useRoute("/:code/supplies");
  const codes = new Set(COUNTRIES.map(option => option.code as string));
  // Country comes from the path (/au/supplies); bare /supplies is geo-redirected by
  // the Worker, but keep ?country= and an AU default as client-side fallbacks.
  const country = (params?.code && codes.has(params.code) ? params.code : null) ?? new URLSearchParams(search).get("country") ?? "au";
  const [data, setData] = useState<SuppliesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const fromUrl = new URLSearchParams(search).get("lang");
      if (fromUrl === "th" || fromUrl === "zh" || fromUrl === "en") return fromUrl;
      const saved = localStorage.getItem("tmfu_supplies_lang");
      if (saved === "th" || saved === "zh") return saved;
    } catch { /* storage blocked */ }
    return "en";
  });
  const t = (key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  const pickLang = (code: Lang) => { setLang(code); try { localStorage.setItem("tmfu_supplies_lang", code); } catch { /* ignore */ } };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/supplies?country=${country}`)
      .then(response => response.json())
      .then((payload: SuppliesPayload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [country]);

  const populated = data?.categories.filter(category => category.offers.length) ?? [];
  const emptyCategories = data?.categories.filter(category => !category.offers.length) ?? [];

  return <><SiteHeader /><main>
    <section className="page-intro">
      <div className="supply-lang-row" role="group" aria-label="Language">
        {LANGS.map(option => <button key={option.code} type="button" onClick={() => pickLang(option.code)} className={option.code === lang ? "supply-lang is-active" : "supply-lang"}>{option.label}</button>)}
      </div>
      <p className="eyebrow">{t("eyebrow")}</p><h1>{t("heading")}</h1>
      <p>{t("intro")}</p>
      <div className="country-switch" role="group" aria-label="Choose country">
        {COUNTRIES.map(option => (
          <Link key={option.code} href={`/${option.code}/supplies`} className={option.code === country ? "country-switch__item is-active" : "country-switch__item"}>
            {option.flag} {option.name}
          </Link>
        ))}
      </div>
    </section>

    {loading ? <section className="places-section"><p className="loading-copy">Checking today's prices…</p></section> : <>
      {populated.map(category => (
        <section className="places-section supplies-section" key={category.key}>
          <div className="section-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h2>{t(category.key) === category.key ? category.label : t(category.key)}</h2></div>
            <div className="supply-compare-links">
              {category.compareUrl && <a href={category.compareUrl} target="_blank" rel="noreferrer noopener sponsored" className="text-link">{t("compare")} <ArrowUpRight size={16} /></a>}
              {category.amazonUrl && <a href={category.amazonUrl} target="_blank" rel="noreferrer noopener sponsored" className="text-link">{t("amazon")} <ArrowUpRight size={16} /></a>}
            </div>
          </div>
          <div className="supply-grid">
            {category.offers.map(offer => (
              <a className="supply-card" key={offer.id} href={`/api/supplies/go?id=${offer.id}`} target="_blank" rel="noreferrer noopener">
                {offer.image ? <div className="supply-card__image" style={{ backgroundImage: `url(${offer.image})` }} /> : <div className="supply-card__image supply-card__image--empty"><PackageOpen size={22} /></div>}
                <div className="supply-card__body">
                  <h3>{offer.title}</h3>
                  <p className="supply-card__price">{money(offer.total, offer.currency)}{offer.freeShipping ? <span className="supply-card__ship"><Truck size={13} /> {t("freeDelivery")}</span> : offer.shipping ? <span className="supply-card__ship">{t("inclDelivery")} {money(offer.shipping, offer.currency)}</span> : null}</p>
                  <span className="supply-card__source">{offer.supplier} <ArrowUpRight size={13} /></span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      {!populated.length && <section className="places-section"><div className="home-place-empty"><h3>{t("empty")}</h3><p>{t("emptyHint")}</p></div></section>}
      {emptyCategories.length > 0 && populated.length > 0 && (
        <section className="places-section supplies-section">
          <div className="section-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h2>{t("more")}</h2></div></div>
          <div className="supply-compare-row">
            {emptyCategories.map(category => category.compareUrl && (
              <a key={category.key} href={category.compareUrl} target="_blank" rel="noreferrer noopener sponsored" className="supply-compare-pill">{t(category.key) === category.key ? category.label : t(category.key)} <ArrowUpRight size={14} /></a>
            ))}
          </div>
        </section>
      )}
      <section className="places-section"><p className="supply-disclosure">{t("disclosure")}{data?.updatedAt ? ` Last refreshed ${data.updatedAt} UTC.` : ""}</p></section>
    </>}
  </main><SiteFooter /></>;
}
