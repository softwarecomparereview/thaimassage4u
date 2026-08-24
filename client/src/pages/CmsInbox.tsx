import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageSquare } from "lucide-react";

export default function CmsInbox() {
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: ["admin-inbox"], queryFn: () => fetch("/api/admin/inbox").then(r => r.json()) });

  async function markRead(id: number) {
    await fetch(`/api/admin/inbox/${id}/read`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["admin-inbox"] });
  }

  if (inbox.isLoading) return <p className="cms-empty">Loading…</p>;
  const messages = inbox.data?.messages ?? [];
  if (!messages.length) return <p className="cms-empty"><span>—</span>No replies yet. Email replies to hello@thaimassageforu.com and SMS replies both land here.</p>;

  return (
    <div className="cms-inbox">
      {messages.map((message: any) => (
        <article key={message.id} className={`cms-inbox-message ${message.read_at ? "" : "is-unread"}`} onClick={() => !message.read_at && markRead(message.id)}>
          <div className="cms-inbox-message__icon">{message.channel === "email" ? <Mail size={16} /> : <MessageSquare size={16} />}</div>
          <div>
            <div className="cms-inbox-message__meta"><strong>{message.from_address}</strong><span>{new Date(message.received_at).toLocaleString()}</span></div>
            {message.subject && <p className="cms-inbox-message__subject">{message.subject}</p>}
            <p className="cms-inbox-message__body">{message.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
