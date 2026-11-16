/*
 * NkapTalk — Cameroonian Pidgin phrasebook (French / English  ->  Pidgin).
 *
 * Every interface string of the SAFINUM test environment, in both page languages,
 * plus common banking messages a jury might inject. Works fully offline.
 *
 * Keys: write "{}" where a value appears (amount, phone, reference...).
 * Outputs: {1}, {2}... put those values back, in the order they appear in the source.
 * Values are never typed here: they always come from the page, unchanged.
 *
 * TO VALIDATE: every line must be checked by native Pidgin speakers (see PIDGIN-REVIEW.md).
 */
(function () {
  const P = (globalThis.NkapTalk = globalThis.NkapTalk || {});

  const ENTRIES = [
    // ---- Test banner, header, footer
    ['Environnement de test — données fictives, aucune transaction réelle.', 'Na test place dis — all di data na fake, no real moni di move.'],
    ['Test environment — fictional data, no real transaction.', 'Na test place dis — all di data na fake, no real moni di move.'],
    ['Protocole de test', 'Rule dem for di test'],
    ['Test protocol', 'Rule dem for di test'],
    ['Retour au hackathon', 'Go back for hackathon'],
    ['Back to hackathon', 'Go back for hackathon'],
    ['Banque en ligne', 'Bank for internet'],
    ['Online banking', 'Bank for internet'],
    ['Connexion sécurisée', 'Connection dey safe'],
    ['Secure connection', 'Connection dey safe'],
    ['{} — environnement de démonstration. Ne saisissez aucune donnée personnelle réelle.', '{1} — na demo place. No put your real personal information here.'],
    ['{} — demonstration environment. Do not enter real personal data.', '{1} — na demo place. No put your real personal information here.'],

    // ---- Steps
    ['Solde', 'Balance'],
    ['Balance', 'Balance'],
    ['Frais', 'Charge'],
    ['Fees', 'Charge'],
    ['Fee', 'Charge'],
    ['Bénéficiaire', 'Who go collect'],
    ['Beneficiary', 'Who go collect'],
    ['Récapitulatif', 'Check am again'],
    ['Summary', 'Check am again'],
    ['Confirmation', 'Confirm'],

    // ---- Dashboard
    ['Votre compte', 'Your account'],
    ['Your account', 'Your account'],
    ['Consultez votre solde et lancez un transfert en toute sécurité.', 'Look your balance, and send moni safe safe.'],
    ['Check your balance and start a secure transfer.', 'Look your balance, and send moni safe safe.'],
    ['Solde disponible', 'Moni wey dey your account'],
    ['Available balance', 'Moni wey dey your account'],
    ['Numéro de compte : {}', 'Account number : {1}'],
    ['Account number : {}', 'Account number : {1}'],
    ['Compte courant', 'Everyday account'],
    ['Current account', 'Everyday account'],
    ['Effectuer un transfert', 'Send moni'],
    ['Make a transfer', 'Send moni'],
    ['Consulter les frais', 'Look di charge'],
    ['View fees', 'Look di charge'],
    ['Transactions récentes', 'Moni wey move last time'],
    ['Recent transactions', 'Moni wey move last time'],
    ['Paiement marchand', 'You pay for shop'],
    ['Merchant payment', 'You pay for shop'],
    ['Salaire reçu', 'Salary don enter'],
    ['Salary received', 'Salary don enter'],
    ['Transfert reçu', 'Moni wey dem send you'],
    ['Transfer received', 'Moni wey dem send you'],
    ['Facture électricité', 'Light bill'],
    ['Electricity bill', 'Light bill'],
    ['Sécurité', 'Make you careful'],
    ['Security', 'Make you careful'],
    ['Vérifiez toujours le nom et le numéro du bénéficiaire avant de confirmer un transfert.', 'Every time, check di name and di number of di pesin wey go collect, before you confirm any transfer.'],
    ['Always verify the beneficiary name and number before confirming a transfer.', 'Every time, check di name and di number of di pesin wey go collect, before you confirm any transfer.'],

    // ---- Fees
    ['Frais de transfert', 'Charge for send moni'],
    ['Transfer fees', 'Charge for send moni'],
    ['Choisissez le type de transfert et le montant. Les frais sont calculés automatiquement.', 'Choose which kind transfer and how much. Di charge go calculate by e self.'],
    ['Choose the transfer type and amount. Fees are calculated automatically.', 'Choose which kind transfer and how much. Di charge go calculate by e self.'],
    ["Type d'opération", 'Which kind transfer'],
    ['Operation type', 'Which kind transfer'],
    ['Compte {}', '{1} account'],
    ['{} account', '{1} account'],
    ['Mobile Money', 'Mobile Money'],
    ['Autre banque', 'Another bank'],
    ['Other bank', 'Another bank'],
    ['Transfert instantané et gratuit', 'E go reach one time, and e free'],
    ['Instant, free transfer', 'E go reach one time, and e free'],
    ['Frais de {} (min. {}, max. {})', 'Charge na {1} (e no fit go under {2}, e no fit pass {3})'],
    ['{} fee (min. {}, max. {})', 'Charge na {1} (e no fit go under {2}, e no fit pass {3})'],
    ['Montant à envoyer', 'How much you wan send'],
    ['Amount to send', 'How much you wan send'],
    ['Gratuit', 'Free'],
    ['Free', 'Free'],
    ['Total à débiter', 'Total wey dem go comot for your account'],
    ['Total to debit', 'Total wey dem go comot for your account'],
    ['Solde après opération', 'Balance after di transfer'],
    ['Balance after transfer', 'Balance after di transfer'],
    ['Retour', 'Go back'],
    ['Back', 'Go back'],
    ['Continuer', 'Continue'],
    ['Continue', 'Continue'],

    // ---- Errors
    ['Une erreur est survenue', 'Something no work well'],
    ['An error occurred', 'Something no work well'],
    ['Solde insuffisant pour effectuer ce transfert.', 'Your moni no reach for dis transfer.'],
    ['Insufficient balance for this transfer.', 'Your moni no reach for dis transfer.'],
    ['Le montant doit être supérieur à zéro.', 'Di amount must pass zero.'],
    ['The amount must be greater than zero.', 'Di amount must pass zero.'],
    ['Vous devez confirmer les informations avant de valider le transfert.', 'You must confirm di information first, before di transfer fit go.'],
    ['You must confirm the details before validating the transfer.', 'You must confirm di information first, before di transfer fit go.'],

    // ---- Beneficiary
    ['Renseignez les informations du destinataire. Vérifiez toujours le numéro avant de valider.', 'Put di information of di pesin wey go collect. Always check di number before you confirm.'],
    ['Enter the recipient details. Always verify the number before confirming.', 'Put di information of di pesin wey go collect. Always check di number before you confirm.'],
    ["Ce bénéficiaire n'a jamais été utilisé sur ce compte. Vérifiez le numéro avant de continuer.", 'You never send moni give dis pesin for dis account before. Check di number before you continue.'],
    ['This beneficiary has never been used on this account. Verify the number before continuing.', 'You never send moni give dis pesin for dis account before. Check di number before you continue.'],
    ['Nom du bénéficiaire', 'Name of di pesin wey go collect'],
    ['Beneficiary name', 'Name of di pesin wey go collect'],
    ['Numéro de téléphone', 'Phone number'],
    ['Phone number', 'Phone number'],
    ['Motif du transfert', 'Why you di send di moni'],
    ['Transfer reason', 'Why you di send di moni'],
    ['Note (optionnel)', 'Note (if you want)'],
    ['Note (optional)', 'Note (if you want)'],
    ["J'ai vérifié le nom et le numéro du bénéficiaire.", 'I don check di name and di phone number of di pesin wey go collect.'],
    ['I have verified the beneficiary name and phone number.', 'I don check di name and di phone number of di pesin wey go collect.'],
    ['Alerte de sécurité', 'Security warning'],
    ['Security warning', 'Security warning'],
    ['Alerte de sécurité : vérifiez le numéro du bénéficiaire avant de continuer.', 'Security warning: check di phone number of di pesin wey go collect before you continue.'],
    ['Security warning: verify the beneficiary phone number before continuing.', 'Security warning: check di phone number of di pesin wey go collect before you continue.'],

    // ---- Summary
    ['Vérifiez les informations avant de confirmer le transfert.', 'Check all di information before you confirm di transfer.'],
    ['Check the details before confirming the transfer.', 'Check all di information before you confirm di transfer.'],
    ['Montant', 'Amount'],
    ['Amount', 'Amount'],
    ['Total débité', 'Total wey dem comot'],
    ['Total debited', 'Total wey dem comot'],
    ['Téléphone', 'Phone'],
    ['Phone', 'Phone'],
    ['Référence', 'Reference'],
    ['Reference', 'Reference'],
    ['Opération', 'Kind of transfer'],
    ['Operation', 'Kind of transfer'],
    ['Je confirme que les informations ci-dessus sont correctes.', 'I confirm say all di information for up dey correct.'],
    ['I confirm the information above is correct.', 'I confirm say all di information for up dey correct.'],
    ['Modifier', 'Change am'],
    ['Edit', 'Change am'],
    ['Confirmer le transfert', 'Confirm di transfer'],
    ['Confirm transfer', 'Confirm di transfer'],

    // ---- Receipt
    ['Transfert effectué', 'Transfer don go'],
    ['Transfer completed', 'Transfer don go'],
    ['Votre transfert a été envoyé avec succès.', 'Your transfer don go well.'],
    ['Your transfer has been sent successfully.', 'Your transfer don go well.'],
    ['Statut', 'Status'],
    ['Status', 'Status'],
    ['Succès', 'E don work'],
    ['Success', 'E don work'],
    ['Nouveau transfert', 'Send another one'],
    ['New transfer', 'Send another one'],

    // ---- Common banking messages (for content the jury may add)
    ['Annuler', 'Cancel am'],
    ['Cancel', 'Cancel am'],
    ['Valider', 'Confirm'],
    ['Validate', 'Confirm'],
    ['Envoyer', 'Send'],
    ['Send', 'Send'],
    ['Fermer', 'Close'],
    ['Close', 'Close'],
    ['Oui', 'Yes'],
    ['Yes', 'Yes'],
    ['Non', 'No'],
    ['No', 'No'],
    ['Attention', 'Take care'],
    ['Warning', 'Warning'],
    ['Erreur', 'Error'],
    ['Error', 'Error'],
    ['Transfert annulé', 'Transfer don cancel'],
    ['Transfer cancelled', 'Transfer don cancel'],
    ['Transfert en cours', 'Di transfer still di go'],
    ['Transfer in progress', 'Di transfer still di go'],
    ['Transaction en cours de traitement.', 'Dem still di work on di transaction.'],
    ['Transaction being processed.', 'Dem still di work on di transaction.'],
    ['Ne communiquez jamais votre code PIN.', 'No ever give anybody your PIN code.'],
    ['Never share your PIN code.', 'No ever give anybody your PIN code.'],
    ['Ne partagez jamais votre code OTP.', 'No ever give anybody your OTP code.'],
    ['Never share your OTP code.', 'No ever give anybody your OTP code.'],
    ['Safinum ne vous demandera jamais votre code PIN.', 'Safinum no go ever ask you for your PIN code.'],
    ['Safinum will never ask for your PIN code.', 'Safinum no go ever ask you for your PIN code.'],
    ['Numéro de téléphone invalide.', 'Dis phone number no correct.'],
    ['Invalid phone number.', 'Dis phone number no correct.'],
    ['Bénéficiaire introuvable.', 'We no see dis pesin wey go collect.'],
    ['Beneficiary not found.', 'We no see dis pesin wey go collect.'],
    ['Plafond journalier atteint.', 'You don reach di highest amount for today.'],
    ['Daily limit reached.', 'You don reach di highest amount for today.'],
    ['Montant maximum dépassé.', 'Di amount don pass di maximum.'],
    ['Maximum amount exceeded.', 'Di amount don pass di maximum.'],
    ['Service temporairement indisponible.', 'Di service no dey work for now. Try again small time.'],
    ['Service temporarily unavailable.', 'Di service no dey work for now. Try again small time.'],
    ['Votre session va expirer.', 'Your session go close soon.'],
    ['Your session will expire.', 'Your session go close soon.'],
    ['Votre session a expiré. Veuillez vous reconnecter.', 'Your session don close. Abeg, connect again.'],
    ['Your session has expired. Please log in again.', 'Your session don close. Abeg, connect again.'],
    ['Veuillez réessayer.', 'Abeg, try am again.'],
    ['Please try again.', 'Abeg, try am again.'],
    ['Opération réussie.', 'E don work.'],
    ['Operation successful.', 'E don work.'],
    ['Code de vérification', 'Code for check'],
    ['Verification code', 'Code for check'],
    ['Code PIN', 'PIN code'],
    ['PIN code', 'PIN code'],
  ];

  // Text patterns whose captured part (a name) is kept exactly as it is.
  const PATTERNS = [
    [/^Bonjour,\s*(.+?)\s*$/i, 'How you dey, $1?'],
    [/^Hello,\s*(.+?)\s*$/i, 'How you dey, $1?'],
    [/^Bonsoir,\s*(.+?)\s*$/i, 'Good evening, $1'],
  ];

  // Short glossary given to the AI for new text, so it stays consistent.
  const GLOSSARY = {
    send: 'send', transfer: 'transfer', confirm: 'confirm', cancel: 'cancel am', balance: 'balance',
    fee: 'charge', beneficiary: 'pesin wey go collect', amount: 'amount', warning: 'warning',
    'security warning': 'security warning', never: 'no ever', 'do not': 'no', account: 'account',
    verify: 'check', error: 'error', 'PIN code': 'PIN code', password: 'password',
  };

  const V = () => P.values;

  function norm(s) {
    return s
      .normalize('NFC')
      .replace(/[’‘ʼ]/g, "'")
      .replace(/[\s  ]+/g, ' ')
      .replace(/\s+([:;!?])/g, ' $1')
      .trim()
      .toLowerCase();
  }

  /** Shape of a masked text: values replaced by "{}". */
  function shapeOfMasked(masked) {
    return norm(masked.replace(/⟦\d+⟧/g, '{}'));
  }

  let table = null;
  function build() {
    table = new Map();
    for (const [src, out] of ENTRIES) {
      // mask each fragment between "{}" so names inside keys become slots too
      const shaped = src
        .split('{}')
        .map((frag) => V().mask(frag).masked)
        .join('⟦0⟧');
      const shape = shapeOfMasked(shaped);
      if (!table.has(shape)) table.set(shape, out);
    }
  }

  /**
   * Translate one string. Returns { text, how } or null when unknown.
   * how: "phrasebook" | "pattern"
   */
  function lookup(text) {
    if (!table) build();
    const trimmed = text.trim();
    for (const [re, out] of PATTERNS) {
      const m = trimmed.match(re);
      if (m) return { text: out.replace('$1', m[1]), how: 'pattern' };
    }
    const { masked, tokens } = V().mask(trimmed);
    const tpl = table.get(shapeOfMasked(masked));
    if (tpl == null) return null;
    const filled = tpl.replace(/\{(\d+)\}/g, (m, n) => {
      const t = tokens[Number(n) - 1];
      return t ? t.value : m;
    });
    return { text: filled, how: 'phrasebook' };
  }

  P.phrasebook = { lookup, norm, ENTRIES, PATTERNS, GLOSSARY, rebuild: build };
})();
