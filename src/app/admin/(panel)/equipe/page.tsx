import { formatDate } from "@/config/admin";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/admin/StatusBadge";
import { ActionForm } from "@/components/admin/ActionForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { createStaff, deleteStaff, resetStaffPassword, toggleStaff } from "../../actions";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const owner = await requireOwner();
  const staff = await db.staffUser.findMany({
    select: { id: true, name: true, email: true, active: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const card = "bg-surface-container-lowest rounded-xl shadow-sm p-6";

  return (
    <>
      <PageTitle title="Équipe" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className={`${card} xl:col-span-2`}>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-1">Comptes</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
            Un compte <b>équipe</b> voit uniquement les commandes : il peut appeler les clients, confirmer et changer les statuts,
            imprimer les bons de livraison. Il ne peut pas supprimer de commande ni accéder aux produits, devis, statistiques ou réglages.
          </p>
          <ul className="divide-y divide-outline-variant/40">
            <li className="py-3 flex items-center gap-3">
              <Icon name="shield_person" className="text-secondary" />
              <div className="flex-1 min-w-0">
                <div className="font-label-metric text-label-metric text-primary">Propriétaire</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{owner.email} · défini dans le fichier .env</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-code text-label-code font-bold">Accès complet</span>
            </li>
            {staff.map((s) => (
              <li key={s.id} className="py-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Icon name="support_agent" className={s.active ? "text-primary" : "text-outline"} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-label-metric text-label-metric ${s.active ? "text-primary" : "text-outline line-through"}`}>{s.name}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {s.email} · {s.lastLoginAt ? `dernière connexion ${formatDate(s.lastLoginAt)}` : "jamais connecté"}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold ${s.active ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {s.active ? "Commandes" : "Désactivé"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 ps-9">
                  <form action={toggleStaff}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="h-9 px-3 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric">
                      {s.active ? "Désactiver" : "Réactiver"}
                    </button>
                  </form>
                  <form action={resetStaffPassword} className="flex gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="password" type="password" minLength={12} required placeholder="Nouveau mot de passe (12+ car.)" autoComplete="new-password" className="field h-9 w-56" />
                    <button className="h-9 px-3 rounded-lg bg-surface-container text-primary font-label-metric text-label-metric">Changer</button>
                  </form>
                  <form action={deleteStaff}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message={`Supprimer le compte de ${s.name} ?`} className="h-9 px-3 rounded-lg border border-error text-error font-label-metric text-label-metric">
                      Supprimer
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {staff.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant pt-3">Aucun compte équipe pour le moment.</p>}
        </section>

        <section className={`${card} self-start`}>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-4">Ajouter un membre</h2>
          <ActionForm action={createStaff} submitLabel="Créer le compte" resetOnSuccess>
            <div>
              <label className="field-label" htmlFor="name">Nom</label>
              <input id="name" name="name" required maxLength={120} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="email">E-mail de connexion</label>
              <input id="email" name="email" type="email" required autoComplete="off" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Mot de passe (12+ car., lettres &amp; chiffres)</label>
              <input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" className="field" />
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
