import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Container,
    Divider,
    Link,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const UPDATED_AT = '24/05/2026';

type LegalTab = 'legal' | 'privacy' | 'terms';

const sections = [
    { id: 'legal' as const, label: 'Mentions legales' },
    { id: 'privacy' as const, label: 'Confidentialite' },
    { id: 'terms' as const, label: 'CGU / CGV' },
];

const BulletList = ({ items }: { items: React.ReactNode[] }) => (
    <Box component="ul" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
        {items.map((item, index) => (
            <li key={index}>
                <Typography variant="body1" component="span">
                    {item}
                </Typography>
            </li>
        ))}
    </Box>
);

export default function Legal() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<LegalTab>('legal');
    const activeTitle = useMemo(
        () => sections.find(section => section.id === activeTab)?.label || sections[0].label,
        [activeTab],
    );

    return (
        <Container maxWidth="md">
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mt: 4, mb: 4, borderRadius: '16px', bgcolor: 'background.paper' }}>
                <Typography variant="overline" color="primary" fontWeight="bold">
                    Informations legales
                </Typography>
                <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
                    {t('sidebar.legal', 'Legal & Privacy')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Derniere mise a jour : {UPDATED_AT}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
                    {sections.map(section => (
                        <Button
                            key={section.id}
                            variant={activeTab === section.id ? 'contained' : 'outlined'}
                            onClick={() => setActiveTab(section.id)}
                        >
                            {section.label}
                        </Button>
                    ))}
                </Stack>

                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    {activeTitle}
                </Typography>
                <Divider sx={{ mb: 3 }} />

                {activeTab === 'legal' && <LegalNotice />}
                {activeTab === 'privacy' && <PrivacyPolicy />}
                {activeTab === 'terms' && <Terms />}
            </Paper>
        </Container>
    );
}

function LegalNotice() {
    return (
        <Stack spacing={4}>
            <Paper variant="outlined" sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Editeur du service</Typography>
                <Typography>
                    SpoolyTracker est edite par Guillaume SANCHEZ, situe a Orcier, France.
                    Les informations administratives complementaires seront completees lorsque l'activite professionnelle concernee sera immatriculee.
                </Typography>
            </Paper>
            <InfoBlock title="Responsable de publication">Guillaume SANCHEZ.</InfoBlock>
            <InfoBlock title="Contact">
                <Link href="mailto:guillaume.sanchez04@gmail.com">guillaume.sanchez04@gmail.com</Link>
            </InfoBlock>
            <InfoBlock title="Hebergement">
                OVH SAS<br />
                2 rue Kellermann<br />
                59100 Roubaix, France
            </InfoBlock>
            <InfoBlock title="Propriete intellectuelle">
                La marque, l'interface, les textes, visuels, logos, elements graphiques et composants logiciels de SpoolyTracker sont proteges.
                Toute reproduction ou reutilisation non autorisee est interdite, sauf accord ecrit prealable.
            </InfoBlock>
        </Stack>
    );
}

function PrivacyPolicy() {
    return (
        <Stack spacing={4}>
            <InfoBlock title="1. Responsable du traitement">
                Les traitements de donnees personnelles lies a SpoolyTracker sont realises sous la responsabilite de Guillaume SANCHEZ.
                Contact : <Link href="mailto:guillaume.sanchez04@gmail.com">guillaume.sanchez04@gmail.com</Link>.
            </InfoBlock>

            <InfoBlock title="2. Donnees traitees">
                <BulletList items={[
                    <>Compte : identifiant, email, nom, prenom, preferences de compte, role et organisation.</>,
                    <>Authentification : jetons de session, informations de connexion, tentatives de connexion, identifiants Google ou Apple lorsque vous utilisez ces methodes.</>,
                    <>Donnees metier : inventaire de filaments, consommations, projets, couts, fichiers d'analyse, parametres d'imprimantes et donnees de synchronisation.</>,
                    <>Notifications : preferences de notification et jetons push si vous activez les notifications mobiles.</>,
                    <>Paiement : informations d'abonnement et de facturation gerees par Stripe. Les donnees de carte bancaire completes ne sont pas stockees par SpoolyTracker.</>,
                    <>API publique : noms, scopes, prefixes, dates d'utilisation et etat de revocation des tokens API. Les secrets complets ne sont pas conserves en clair.</>,
                    <>Technique et securite : adresse IP, logs techniques, erreurs, navigateur, horodatages et evenements utiles a la securite du service.</>,
                ]} />
            </InfoBlock>

            <InfoBlock title="3. Finalites et bases legales">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Finalite</TableCell>
                            <TableCell>Base legale</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {[
                            ['Creation et gestion du compte, acces au service, organisations et roles', 'Execution du contrat'],
                            ['Gestion de l inventaire, projets, consommations, analyses et API publique', 'Execution du contrat'],
                            ['Paiement, abonnements, factures et obligations comptables', 'Execution du contrat et obligations legales'],
                            ['Securite, prevention des abus, journalisation technique', 'Interet legitime'],
                            ['Notifications et preferences utilisateur', 'Execution du contrat ou consentement selon le canal'],
                            ['Amelioration du service et statistiques globales', 'Interet legitime, avec donnees agregees autant que possible'],
                        ].map(([purpose, basis]) => (
                            <TableRow key={purpose}>
                                <TableCell>{purpose}</TableCell>
                                <TableCell>{basis}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </InfoBlock>

            <InfoBlock title="4. Destinataires et sous-traitants">
                <BulletList items={[
                    <>OVH SAS : hebergement de l'infrastructure et des donnees.</>,
                    <>Stripe : paiement, abonnements, facturation et portail client.</>,
                    <>Google et Apple : authentification sociale lorsque vous choisissez ces modes de connexion.</>,
                    <>Expo / Firebase Cloud Messaging : notifications push mobiles si activees.</>,
                    <>Prestataire email SMTP : emails transactionnels, verification de compte et support.</>,
                ]} />
            </InfoBlock>

            <InfoBlock title="5. Transferts hors Union europeenne">
                Certains prestataires, notamment Stripe, Google, Apple, Expo ou Firebase, peuvent traiter des donnees hors de l'Union europeenne.
                Lorsque cela est applicable, ces transferts reposent sur les mecanismes prevus par le RGPD, tels que les clauses contractuelles types ou les garanties proposees par les prestataires concernes.
            </InfoBlock>

            <InfoBlock title="6. Durees de conservation">
                <BulletList items={[
                    <>Compte et donnees metier : pendant la duree d'utilisation du service, puis suppression ou anonymisation apres suppression du compte, sauf obligation contraire.</>,
                    <>Logs de securite : duree limitee necessaire a la securite et au diagnostic, generalement jusqu'a 12 mois.</>,
                    <>Donnees de facturation : conservees selon les obligations comptables et fiscales applicables.</>,
                    <>Tokens API : jusqu'a suppression ou revocation par l'utilisateur, avec conservation des traces utiles a la securite.</>,
                    <>Demandes support : pendant la duree necessaire au traitement de la demande puis archivage raisonnable.</>,
                ]} />
            </InfoBlock>

            <InfoBlock title="7. Cookies et traceurs">
                <Typography paragraph>
                    SpoolyTracker utilise des cookies strictement necessaires au fonctionnement du service. Ils ne requierent pas de consentement prealable.
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Nom</TableCell>
                            <TableCell>Finalite</TableCell>
                            <TableCell>Duree</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell><code>access_token</code></TableCell>
                            <TableCell>Maintien de la session utilisateur et authentification securisee</TableCell>
                            <TableCell>Jusqu'a 7 jours</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </InfoBlock>

            <InfoBlock title="8. Vos droits">
                Vous pouvez demander l'acces, la rectification, l'effacement, la limitation, l'opposition et la portabilite de vos donnees lorsque ces droits s'appliquent.
                Contact : <Link href="mailto:guillaume.sanchez04@gmail.com">guillaume.sanchez04@gmail.com</Link>. Vous pouvez aussi introduire une reclamation aupres de la CNIL : <Link href="https://www.cnil.fr" target="_blank" rel="noreferrer">www.cnil.fr</Link>.
            </InfoBlock>

            <InfoBlock title="9. Securite">
                SpoolyTracker met en oeuvre des mesures raisonnables pour proteger les comptes, les sessions, les tokens API et les donnees hebergees.
                Les utilisateurs restent responsables de la confidentialite de leurs identifiants et des tokens API qu'ils generent.
            </InfoBlock>
        </Stack>
    );
}

function Terms() {
    return (
        <Stack spacing={4}>
            <InfoBlock title="1. Objet">
                SpoolyTracker est un service de gestion de stock de filaments, de suivi de consommations, d'analyse de couts, d'organisation de projets et d'integrations avec des outils tiers.
                Les presentes conditions encadrent l'utilisation du site, de l'application web, de l'application mobile, des API et des services associes.
            </InfoBlock>
            <InfoBlock title="2. Compte utilisateur">
                <BulletList items={[
                    <>L'utilisateur doit fournir des informations exactes et maintenir son compte a jour.</>,
                    <>L'utilisateur est responsable de la confidentialite de ses identifiants, sessions, appareils connectes et tokens API.</>,
                    <>Toute action effectuee depuis un compte ou un token API valide est reputee effectuee par son titulaire ou son organisation.</>,
                    <>SpoolyTracker peut suspendre un compte en cas d'usage abusif, frauduleux, dangereux ou contraire aux presentes conditions.</>,
                ]} />
            </InfoBlock>
            <InfoBlock title="3. Organisations et donnees partagees">
                Certaines fonctionnalites reposent sur des organisations, roles et droits d'acces. Les administrateurs d'une organisation peuvent inviter des membres, gerer certains parametres et acceder aux donnees de l'organisation.
            </InfoBlock>
            <InfoBlock title="4. API publique et integrations tierces">
                <BulletList items={[
                    <>Les tokens API publique permettent a des applications tierces d'acceder aux donnees d'une organisation selon les scopes choisis.</>,
                    <>Le secret d'un token API n'est affiche qu'a sa creation. L'utilisateur doit le conserver de maniere securisee.</>,
                    <>L'utilisateur est responsable des integrations, scripts et applications tierces auxquels il confie un token.</>,
                    <>Un token compromis doit etre revoque sans delai depuis les parametres du compte.</>,
                    <>SpoolyTracker peut limiter, suspendre ou revoquer l'acces API en cas d'abus, surcharge, risque securite ou usage non conforme.</>,
                ]} />
            </InfoBlock>
            <InfoBlock title="5. Abonnements, tarifs et paiement">
                SpoolyTracker peut proposer un plan gratuit et des plans payants avec des limites et fonctionnalites differentes.
                Les tarifs applicables sont ceux affiches au moment de la souscription. Les paiements, abonnements, factures et moyens de paiement sont geres par Stripe.
                Sauf indication contraire, les abonnements se renouvellent automatiquement a chaque periode de facturation.
            </InfoBlock>
            <InfoBlock title="6. Resiliation">
                L'utilisateur peut resilier son abonnement depuis l'application ou le portail client Stripe lorsqu'il est disponible.
                La resiliation prend effet a la fin de la periode de facturation en cours. Sauf obligation legale contraire ou geste commercial, la periode deja entamee n'est pas remboursee.
            </InfoBlock>
            <InfoBlock title="7. Droit de retractation">
                Pour les consommateurs, un droit de retractation de 14 jours peut s'appliquer. Toutefois, lorsqu'un service numerique est fourni immediatement apres accord expres de l'utilisateur et renoncement explicite a son droit de retractation, ce droit peut ne plus s'appliquer conformement aux dispositions du Code de la consommation.
                Les interfaces de souscription doivent recueillir cet accord lorsque cela est necessaire.
            </InfoBlock>
            <InfoBlock title="8. Disponibilite, maintenance et sauvegardes">
                SpoolyTracker s'efforce d'assurer une disponibilite raisonnable du service. Des interruptions peuvent toutefois intervenir pour maintenance, mise a jour, incident technique, securite ou force majeure.
                L'utilisateur est invite a conserver ses propres sauvegardes des informations importantes lorsque cela est possible.
            </InfoBlock>
            <InfoBlock title="9. Responsabilite">
                <BulletList items={[
                    <>SpoolyTracker fournit des outils d'aide au suivi et au calcul, sans garantir l'absence totale d'erreur de mesure, de cout, de stock ou d'analyse.</>,
                    <>L'utilisateur reste responsable de ses decisions d'achat, de production, d'impression et d'utilisation des integrations.</>,
                    <>SpoolyTracker ne peut etre tenu responsable des dommages indirects, pertes d'exploitation, pertes de donnees dues a une mauvaise utilisation, ou consequences d'une integration tierce non maitrisee.</>,
                ]} />
            </InfoBlock>
            <InfoBlock title="10. Comportements interdits">
                <BulletList items={[
                    <>Tenter de contourner les limites, roles, quotas ou mesures de securite.</>,
                    <>Utiliser le service pour porter atteinte a des tiers ou a l'infrastructure.</>,
                    <>Partager des tokens API ou identifiants de maniere publique ou non securisee.</>,
                    <>Effectuer du scraping, de la surcharge, de l'automatisation abusive ou des tests intrusifs sans autorisation.</>,
                ]} />
            </InfoBlock>
            <InfoBlock title="11. Reclamation et mediation">
                Pour toute reclamation, l'utilisateur peut contacter SpoolyTracker a <Link href="mailto:guillaume.sanchez04@gmail.com">guillaume.sanchez04@gmail.com</Link>.
                Si l'utilisateur agit en qualite de consommateur et qu'aucune solution amiable n'est trouvee, il pourra recourir a un mediateur de la consommation lorsque le service aura designe l'organisme competent.
                Cette information sera completee avant toute commercialisation reguliere a destination des consommateurs si necessaire.
            </InfoBlock>
            <InfoBlock title="12. Droit applicable">
                Les presentes conditions sont soumises au droit francais. En cas de litige, les parties rechercheront d'abord une solution amiable.
                A defaut, les juridictions competentes seront determinees selon les regles legales applicables.
            </InfoBlock>
            <InfoBlock title="13. Modification des conditions">
                SpoolyTracker peut modifier les presentes conditions pour tenir compte de l'evolution du service, de la loi ou des contraintes techniques.
                Les utilisateurs seront informes des changements importants par un moyen adapte.
            </InfoBlock>
        </Stack>
    );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {title}
            </Typography>
            <Typography component="div" color="text.secondary">
                {children}
            </Typography>
        </Box>
    );
}
