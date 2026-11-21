import { formatPrice } from "@/config/catalog";
import { requireOwner } from "@/lib/auth";
import { CLOSED_QUOTE_RETENTION_DAYS, VISITOR_RETENTION_DAYS, getPrivacyRetentionCounts } from "@/lib/privacy";
import { getShopSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/site/Logo";
import { PageTitle } from "@/components/admin/StatusBadge";
import { ActionForm } from "@/components/admin/ActionForm";
import { runPrivacyCleanupAction, saveSettings } from "../../actions";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  await requireOwner();
  const [settings, retention] = await Promise.all([getShopSettings(), getPrivacyRetentionCounts()]);
  const hasToken = Boolean(settings.metaAccessToken);
  const card = "bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-4";
  const title = "font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2";
  const help = "font-body-sm text-body-sm text-on-surface-variant mt-1";

  return (
    <>
      <PageTitle title="Réglages" />
      <ActionForm action={saveSettings} submitLabel="Enregistrer les réglages" className="max-w-3xl">
        <section className={card}>
          <h2 className={title}><Icon name="image" className="text-secondary" /> Logo de la boutique</h2>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="w-36 h-20 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden shrink-0 p-2">
              {settings.logoImage ? (
                <img src={settings.logoImage} alt="Logo actuel" className="max-w-full max-h-full object-contain" />
              ) : (
                <Logo name="Top Joint" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="field-label" htmlFor="logo">Choisir un nouveau logo</label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="block w-full font-body-sm text-body-sm file:me-3 file:rounded-lg file:border-0 file:bg-surface-container file:px-3 file:py-2 file:font-bold file:text-primary"
              />
              <p className={help}>PNG avec fond transparent recommandé, 10 Mo max. Le logo remplace la marque dans l&apos;en-tête, le pied de page et l&apos;espace admin.</p>
              {settings.logoImage && (
                <label className="flex items-center gap-2 mt-2 font-body-sm text-body-sm text-error">
                  <input type="checkbox" name="removeLogo" className="w-4 h-4" /> Revenir au logo par défaut
                </label>
              )}
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className={title}><Icon name="local_shipping" className="text-secondary" /> Livraison</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="deliveryFee">Frais de livraison (TND)</label>
              <input id="deliveryFee" name="deliveryFee" inputMode="decimal" defaultValue={formatPrice(settings.deliveryFeeMillimes)} className="field" />
              <p className={help}>Ajoutés à chaque commande. 0 = livraison gratuite.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="freeDeliveryFrom">Livraison offerte dès (TND)</label>
              <input
                id="freeDeliveryFrom"
                name="freeDeliveryFrom"
                inputMode="decimal"
                defaultValue={settings.freeDeliveryFromMillimes ? formatPrice(settings.freeDeliveryFromMillimes) : ""}
                placeholder="Jamais"
                className="field"
              />
              <p className={help}>Laisser vide pour toujours facturer la livraison.</p>
            </div>
          </div>
          <p className={help}>Les commandes déjà passées gardent leurs frais ; vous pouvez les modifier sur chaque commande.</p>
        </section>

        <section className={card}>
          <h2 className={title}><Icon name="campaign" className="text-secondary" /> Meta (Facebook / Instagram Ads)</h2>
          <p className={help}>
            Le pixel envoie aux publicités Meta les événements PageView, ViewContent, AddToCart, InitiateCheckout et Purchase
            (au clic du client sur « Confirmer la commande »). Avec le jeton Conversions API, les mêmes événements sont aussi envoyés
            depuis le serveur (plus fiable face aux bloqueurs et à iOS), sans doublons.
          </p>
          <div>
            <label className="field-label" htmlFor="metaPixelId">ID du pixel</label>
            <input id="metaPixelId" name="metaPixelId" defaultValue={settings.metaPixelId} inputMode="numeric" placeholder="123456789012345" className="field" />
            <p className={help}>Events Manager → Sources de données → votre pixel → Paramètres. Laisser vide pour désactiver le suivi.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="metaAccessToken">Jeton d&apos;accès Conversions API</label>
            <input
              id="metaAccessToken"
              name="metaAccessToken"
              type="password"
              autoComplete="off"
              placeholder={hasToken ? "•••••••• enregistré — laisser vide pour le garder" : "EAAB..."}
              className="field"
            />
            <p className={help}>Même page → « Conversions API » → « Générer un jeton d&apos;accès ». Il reste sur le serveur.</p>
            {hasToken && (
              <label className="flex items-center gap-2 mt-2 font-body-sm text-body-sm text-error">
                <input type="checkbox" name="removeToken" className="w-4 h-4" /> Supprimer le jeton enregistré
              </label>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="metaTestEventCode">Code d&apos;événement test (facultatif)</label>
            <input id="metaTestEventCode" name="metaTestEventCode" defaultValue={settings.metaTestEventCode} placeholder="TEST12345" className="field" />
            <p className={help}>Pour vérifier les événements serveur dans Events Manager → « Tester les événements ». Videz-le ensuite.</p>
          </div>
          <div className="flex flex-wrap gap-2 font-label-code text-label-code">
            <span className={`px-2 py-1 rounded font-bold ${settings.metaPixelId ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}`}>
              Pixel : {settings.metaPixelId ? "actif" : "inactif"}
            </span>
            <span className={`px-2 py-1 rounded font-bold ${settings.metaPixelId && hasToken ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}`}>
              Conversions API : {settings.metaPixelId && hasToken ? "active" : "inactive"}
            </span>
          </div>
        </section>
      </ActionForm>

      <section className={`${card} max-w-3xl mt-6`}>
        <h2 className={title}><Icon name="privacy_tip" className="text-secondary" /> Confidentialité &amp; rétention des données</h2>
        <p className={help}>
          Minimisation des données personnelles : les métadonnées IP / navigateur (<code>metaVisitor</code>) des commandes de plus de {VISITOR_RETENTION_DAYS} jours,
          les demandes de devis clôturées (et leurs pièces jointes) de plus de {CLOSED_QUOTE_RETENTION_DAYS} jours, ainsi que les jetons révoqués et compteurs expirés
          peuvent être purgés sans supprimer l&apos;historique comptable des commandes.
        </p>
        <ul className="grid sm:grid-cols-3 gap-3 font-body-sm text-body-sm">
          <li className="p-3 rounded-lg bg-surface-container-low">
            <div className="font-bold text-primary">{retention.oldOrderVisitors}</div>
            <div className="text-on-surface-variant">Commandes &gt; {VISITOR_RETENTION_DAYS} j avec IP/navigateur</div>
          </li>
          <li className="p-3 rounded-lg bg-surface-container-low">
            <div className="font-bold text-primary">{retention.oldClosedQuotes}</div>
            <div className="text-on-surface-variant">Devis clôturés &gt; {CLOSED_QUOTE_RETENTION_DAYS} j</div>
          </li>
          <li className="p-3 rounded-lg bg-surface-container-low">
            <div className="font-bold text-primary">{retention.expiredTokens + retention.staleRateLimits}</div>
            <div className="text-on-surface-variant">Jetons / limites expirés</div>
          </li>
        </ul>
        <ActionForm action={runPrivacyCleanupAction} submitLabel="Exécuter le nettoyage">
          <></>
        </ActionForm>
      </section>
    </>
  );
}
