import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { toConfirmStatuses } from "@/config/admin";
import { db } from "@/lib/db";
import { getShopSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/site/Logo";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const isOwner = admin.role === "owner";
  const [newQuotes, toConfirm, settings] = await Promise.all([
    isOwner ? db.quoteRequest.count({ where: { status: "NEW" } }) : 0,
    db.order.count({ where: { status: { in: toConfirmStatuses } } }),
    getShopSettings().catch(() => null),
  ]);

  const links = [
    { href: "/admin", icon: "dashboard", label: "Tableau de bord", badge: 0, owner: true },
    { href: "/admin/demandes", icon: "request_quote", label: "Demandes de devis", badge: newQuotes, owner: true },
    { href: "/admin/commandes", icon: "shopping_bag", label: "Commandes", badge: toConfirm, owner: false },
    { href: "/admin/produits", icon: "inventory_2", label: "Produits", badge: 0, owner: true },
    { href: "/admin/equipe", icon: "group", label: "Équipe", badge: 0, owner: true },
    { href: "/admin/audit", icon: "security", label: "Journal d'audit", badge: 0, owner: true },
    { href: "/admin/reglages", icon: "settings", label: "Réglages", badge: 0, owner: true },
  ].filter((link) => isOwner || !link.owner);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="bg-primary text-on-primary lg:min-h-screen p-5 flex lg:flex-col gap-6 justify-between">
        <div className="space-y-8 w-full">
          <Link href={isOwner ? "/admin" : "/admin/commandes"}>
            <Logo name="Top Joint" tagline={isOwner ? "Admin" : "Équipe"} inverted image={settings?.logoImage ?? ""} />
          </Link>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary-container font-label-metric text-label-metric whitespace-nowrap">
                <Icon name={link.icon} className="text-[20px] text-secondary-container" />
                <span className="flex-1">{link.label}</span>
                {link.badge > 0 && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-primary text-[11px] font-bold">{link.badge}</span>}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden lg:block space-y-3 font-label-code text-label-code text-on-primary-container">
          <Link href="/fr" target="_blank" className="flex items-center gap-2 hover:text-on-primary">
            <Icon name="open_in_new" className="text-[16px]" /> Voir le site
          </Link>
          <div className="truncate">
            <div className="text-on-primary">{admin.name}</div>
            {admin.email}
          </div>
          <form action={logout}>
            <button className="flex items-center gap-2 hover:text-on-primary">
              <Icon name="logout" className="text-[16px]" /> Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <main className="p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
