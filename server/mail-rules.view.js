/* mail-rules.view.js - 26 Nov 2026
 *
 * "Publish my rules as a setting in Rugs Email, in Settings and Admin control, so that if we
 *  change any rule it tells us what it conflicts with and what error that change will cause."
 *
 * This file is the whole Mail rules screen. It is embedded into the mail app by
 *   node server/patch-mail-rules.js
 * between the markers __rules:start / __rules:end, so editing this file and running the
 * patch again replaces the old block instead of doubling it.
 *
 * THREE PARTS
 *   1. RULES  - the registry: every rule that decides who sees which mail, read out of the
 *               shipped code (MAIL-RULES-LIVE.md list A), each with what it does now, what
 *               breaks if it is changed, and who it affects.
 *   2. rChk() - the conflict engine. Before a switch is applied it works out the HARD
 *               conflicts (the change is refused), the WARNINGS, and the real EFFECT in
 *               live numbers from the mail actually loaded in this browser.
 *   3. The page - Admin -> Mail rules (with the switches) and the same thing read-only from
 *               the menu under your own name, so everybody can read the rules.
 *
 * DEFAULTS ARE TODAY'S BEHAVIOUR. Nothing changes until an admin moves a switch.
 */

/* ---------------------------------------------------------------- state ---- */
const RULES_KEY = 'mail_rules';
const RULES_BUILD = (typeof APP_BUILD !== 'undefined' ? APP_BUILD : '');
/* The shipped behaviour - a switch with no saved value behaves like this.
   R17 went true on the night of 26/27 Nov (plan P1): every mail in a conversation gets its
   own row, its own sender and its own time. It is a switch now, so turning it back off is
   one click on this page and needs no build. */
const RDEF = { R1: true, R3: true, R7: true, R10: true, R11: true, R17: true, R27: false, C5: false };

function rulesObj() {
  try { const o = (S.settings && S.settings[RULES_KEY]) || null; return (o && typeof o === 'object') ? o : {}; }
  catch (e) { return {}; }
}
function RV(k) { const o = rulesObj().vals || {}; return (o[k] === undefined) ? RDEF[k] : o[k]; }
function RON(k) { return !!RV(k); }
function rLog() { const l = rulesObj().log; return Array.isArray(l) ? l : []; }
/* the gate the app's own can() asks: C5 gives transfer and assign to everybody */
function RCAN(k) { return (k === 'transfer' || k === 'assign') && RON('C5'); }
/* manager-first teams live in the shared setting the SERVER also reads (rm_auto_give) */
function rMgrList() { try { const v = S.settings && S.settings.mgr_first_boxes; return Array.isArray(v) ? v.map(x => String(x).toLowerCase()) : []; } catch (e) { return []; } }

/* ------------------------------------------------------------ live counts -- */
/* every number on this page is counted from the mail this browser has actually loaded,
   so it is a real "this is what would happen", not an estimate. It says so on screen. */
function rMine() { try { return S.threads.filter(t => inScopeBox(t)); } catch (e) { return S.threads || []; } }
function inScopeBox(t) { try { return !!dept(t.dept); } catch (e) { return true; } }
function rInbox() { try { return rMine().filter(t => t.folder === 'inbox' && typeof hasRecv === 'function' && hasRecv(t)); } catch (e) { return []; } }
function rN(f) { try { return rInbox().filter(f).length; } catch (e) { return 0; } }
function rPlural(n, w, w2) { return n + ' ' + (n === 1 ? w : (w2 || w + 's')); }

/* people who see everything anyway */
function rBosses() { return PEOPLE.filter(p => p.active !== false && (p.role === 'Admin' || p.role === 'Manager' || p.role === 'Lead' || p.role === 'CRM')); }
function rMembers() { return PEOPLE.filter(p => p.active !== false && !(p.role === 'Admin' || p.role === 'Manager' || p.role === 'Lead' || p.role === 'CRM')); }
function rDeptBosses(did) { return rBosses().filter(p => p.role === 'Admin' || p.dept === did); }
/* a team whose unassigned mail would reach nobody but the admin */
function rNoManager() { return DEPTS.filter(d => PEOPLE.filter(p => p.active !== false && p.dept === d.id && ['Manager', 'Lead', 'CRM'].includes(p.role)).length === 0); }

/* ============================================================== REGISTRY === */
/* k: 'sw' a switch that really works here · 'fx' built into the app, reading only ·
      'srv' decided on the server · 'off' built and tested but not switched on in this build ·
      'set' an existing setting this page also controls                                   */
const RULES = [
  /* ------------------------------------------------------------- Inbox ---- */
  {
    id: 'R1', g: 'Inbox', k: 'sw', n: 'Mail nobody has taken is seen by the whole team',
    now: v => v ? 'Everyone in the team sees it and anyone can pick it up.'
      : 'Only the Manager, Lead, CRM and Admin see it. A member finds it under "Needs owner" and behind the "Unassigned" chip.',
    who: 'Every team member. Managers, Leads, CRM and Admins are never affected.',
    brk: [
      'A buyer\'s first mail waits for the manager to hand it out, so a team with a busy manager answers buyers more slowly.',
      'This is the rule that caused four "my mail is missing" reports on 26 November. It was switched off that afternoon and put back the same evening.',
      'A member can still take the mail - it is under "Needs owner", not gone.'
    ]
  },
  {
    id: 'R3', g: 'Inbox', k: 'sw', n: 'A conversation somebody has taken is private to them',
    now: v => v ? 'The owner, anyone who replied in it, and the Manager / Lead / CRM / Admin see it. Other members do not.'
      : 'EVERYBODY in the team sees every conversation, whoever owns it.',
    who: 'Every team member.',
    brk: [
      'Off means five people sharing teampulse@ all read each other\'s buyer correspondence. That was the complaint on 26 November ("now Ashok sees Arun\'s and Ashish\'s mail").',
      'Off also makes every member\'s Inbox and unread count the size of the whole mailbox.',
      'On is what makes a shared mailbox feel like your own Inbox.'
    ]
  },
  {
    id: 'R7', g: 'Inbox', k: 'sw', n: 'Mail marked Done stays in the Inbox',
    now: v => v ? 'Done mail is still in the Inbox, just out of My work and Needs owner.'
      : 'Done mail LEAVES the Inbox. The Inbox becomes "work still to do".',
    who: 'Everybody, in every mailbox.',
    brk: [
      '43,296 conversations from before 16 November were marked Done in one sweep on 17 November, and the whole history of the three newest mailboxes arrives Done. Switching this off takes all of that out of the Inbox at once.',
      'People read "it is not in my Inbox" as "it is lost". That is why Done was left visible.',
      'Search and the folder itself still find it either way.'
    ]
  },
  {
    id: 'R2', g: 'Inbox', k: 'fx', n: 'A conversation assigned to me is in my Inbox with my name on the row',
    now: () => 'Always on. It is what "assigned" means.', who: 'Everybody.',
    brk: ['Nothing to change - this is the one rule the whole ownership idea rests on.']
  },
  {
    id: 'R4', g: 'Inbox', k: 'fx', n: 'A conversation I replied in stays mine, even once somebody else owns it',
    now: () => 'Always on. Work you have already done never disappears off your screen.', who: 'Everybody.',
    brk: ['Off would mean a hand-over hides the trail from the person who did the first half of the work.']
  },
  {
    id: 'R5', g: 'Inbox', k: 'fx', n: 'I replied to mail nobody had taken - I keep it',
    now: () => 'Always on, and it is the fix for the 26 November bug where replying made mail vanish from the replier\'s own Inbox.', who: 'Every team member.',
    brk: ['This one is load-bearing: without it, answering unassigned mail hides it from you the moment you answer.']
  },
  {
    id: 'R6', g: 'Inbox', k: 'fx', n: 'A colleague writing into the team mailbox counts as incoming mail',
    now: () => 'On. Anyone @rugscreation.com writing in makes the conversation unread and reopens it if it was Done.', who: 'Everybody.',
    brk: ['Before 24 November a colleague\'s mail did not reopen a Done conversation, which is how "Ashok replied twice and it never came back" happened.']
  },
  {
    id: 'R8', g: 'Inbox', k: 'fx', n: 'Mail we sent that nobody has answered is in Sent only',
    now: () => 'On. Nothing we only sent appears in the Inbox.', who: 'Everybody.',
    brk: ['Off would put every forward and every reminder into the Inbox as if a buyer had written it.']
  },
  {
    id: 'R9', g: 'Inbox', k: 'fx', n: 'Mail we send to our own mailbox shows in the Inbox and in Sent',
    now: () => 'On, the way Gmail does it.', who: 'Everybody.',
    brk: ['Off would make a test mail to your own address disappear - reported on 16 November.']
  },
  {
    id: 'R10', g: 'Inbox', k: 'sw', n: 'A login code (OTP) is shown to the whole team',
    now: v => v ? 'Anyone in the team sees it, even if a colleague owns the conversation, and it is tagged 🔑 Login code. It never counts as work.'
      : 'A login code follows the ordinary rules - so a code sent to the team mailbox can be invisible to the person waiting for it.',
    who: 'Everybody who signs in to anything with a code sent to a team mailbox.',
    brk: [
      'A code is only any use to the person signing in at that moment. Off, and the code can sit in a colleague\'s private conversation or behind the Unassigned chip while they are locked out.',
      'This was reported on 20 November as "OTP is not showing on email" - three separate rules were hiding them.'
    ]
  },
  {
    id: 'R11', g: 'Inbox', k: 'sw', n: 'Workspace notifications go to their own folder',
    now: v => v ? 'Automatic Rugs Creation Workspace mail sits in 🔔 Workspace notifications and never counts as work.'
      : 'Those mails land in the Inbox with everything else and are counted like buyers\' mail.',
    who: 'Everybody.',
    brk: [
      'Off floods every Inbox with "Your pending tasks" and "Sampling report" mail and inflates every unread count.',
      'They are not work: nobody answers a notification.'
    ]
  },
  {
    id: 'R12', g: 'Inbox', k: 'srv', n: 'Automatic mail (no-reply, newsletters) is closed as Done on arrival',
    now: () => 'On, decided during the sync on the office server, and tagged "Auto".', who: 'Everybody.',
    brk: ['Off would put every newsletter into Needs owner and into somebody\'s work list.',
      'Changing it needs a change on the office server, not here.']
  },
  {
    id: 'R13', g: 'Inbox', k: 'fx', n: 'Archive, Junk and Deleted take mail out of the Inbox',
    now: () => 'On - and this is a person\'s own choice, not a rule about other people.', who: 'Everybody.',
    brk: ['These three plus a personal folder are the only things that should ever move mail out of the Inbox.']
  },
  {
    id: 'NODATE', g: 'Inbox', k: 'fx', n: 'No date cut - a conversation stays in the Inbox whatever its age',
    now: () => 'On since 26 November. The old rolling window silently dropped old conversations out of five different places.', who: 'Everybody.',
    brk: ['The window was the cause of the third "a buyer\'s mail is not in the Inbox" report. It is one line (in60) if it is ever wanted back.']
  },

  /* -------------------------------------------------------------- Sent ---- */
  {
    id: 'R14', g: 'Sent', k: 'fx', n: 'A conversation we wrote in is in Sent, answered or not',
    now: () => 'On. It is in the Inbox as well when somebody wrote to us.', who: 'Everybody.', brk: ['Nothing to change.']
  },
  {
    id: 'R15', g: 'Sent', k: 'fx', n: '"Mine" in Sent = sent from Rugs Email by me, or from Outlook under my own name, or from my own address or alias',
    now: () => 'On, and the name matching forgives spelling (Jagjeet = Jagjit, GULAB TYAGI = Gulab Tyagi).', who: 'Every team member.',
    brk: ['A shared mailbox has ONE Sent folder on Google\'s side, so without this rule everybody reads everybody\'s sent mail.']
  },
  {
    id: 'R16', g: 'Sent', k: 'fx', n: 'Mail sent under a name that is nobody\'s stays with the whole team',
    now: () => 'On. 372 messages went out as "Team Pulse" / "team alpha" and cannot be traced to a person, so nothing is hidden.', who: 'Every team member.',
    brk: ['Making them manager-only is written and tested (R16q) but is not switched on in this build.']
  },
  {
    id: 'R17', g: 'Sent', k: 'sw', n: 'One row per mail, each with its own time', inv: true,
    now: v => v ? 'Every mail in a conversation has its own row, its own sender and its own time. Clicking a row opens that mail.'
      : 'One row per conversation, named after the newest mail. Older mails are inside it.',
    who: 'Everybody - this changes what the whole mail list looks like.',
    brk: [
      'This decision has been turned over three times in three days. On per-mail rows the list builds about 4.6 rows per conversation, so the browser does more work and holds more in memory.',
      'On conversation rows a mail like Aman Singh Verma\'s 25 November 17:34 has no row of its own - the row shows whoever wrote last.',
      'Everything that supports per-mail rows is in the app and tested: the 150-row window counts conversations either way, so the Inbox reaches equally far down.'
    ]
  },
  {
    id: 'R18', g: 'Sent', k: 'fx', n: 'A Sent row shows our words, our time and "To: ..."',
    now: () => 'On. Without it Sent read like a second Inbox showing the buyer\'s newest mail.', who: 'Everybody.', brk: ['Nothing to change.']
  },

  /* --------------------------------------------- Needs owner / To assign -- */
  {
    id: 'R19', g: 'Needs owner', k: 'fx', n: 'Needs owner = no owner, in the Inbox, not Done, newer than the team\'s go-live',
    now: () => 'On.', who: 'Managers and the Admin, plus every member who opens the list.', brk: ['Nothing to change.']
  },
  {
    id: 'R20', g: 'Needs owner', k: 'fx', n: 'Unassigned but Done is NOT in Needs owner, and still in the Inbox',
    now: () => 'On. This is why "1,062 in the Inbox" and "11 in Needs owner" are both right for Team Alpha.', who: 'Everybody.',
    brk: ['It depends on R7. If Done mail is taken out of the Inbox, these two numbers stop being explainable to people.']
  },
  {
    id: 'R21', g: 'Needs owner', k: 'fx', n: 'To assign - the Manager for his own team, the Admin for every mailbox',
    now: () => 'On. There is no CRM any more: Priya has left, so unassigned mail is each Manager\'s job and the Admin\'s.', who: 'Managers, Leads and Admins.',
    brk: ['A team with no Manager and no Lead has nobody holding this list except the Admin. See the checks at the top of this page.']
  },

  /* ----------------------------------------------------------- My work ---- */
  {
    id: 'R22', g: 'My work', k: 'fx', n: 'My work = I own it or I replied in it, it is not Done, and somebody wrote to us',
    now: () => 'On.', who: 'Everybody.', brk: ['Nothing to change.']
  },
  {
    id: 'R23', g: 'My work', k: 'fx', n: 'A conversation I only sent is not work and has no Done button',
    now: () => 'On since 17 November - Vinay\'s forward kept coming back asking to be marked done.', who: 'Everybody.', brk: ['Nothing to change.']
  },
  {
    id: 'R24', g: 'My work', k: 'fx', n: 'Marked Done leaves My work and stays in the Inbox',
    now: () => 'On - and the second half of it is rule R7 above.', who: 'Everybody.', brk: ['Tied to R7.']
  },
  {
    id: 'R25', g: 'My work', k: 'fx', n: 'Two people replied - it is in both their lists',
    now: () => 'On. Replying makes you a participant.', who: 'Everybody.', brk: ['Nothing to change.']
  },
  {
    id: 'R26', g: 'My work', k: 'fx', n: 'Somebody else\'s conversation is never in my My work, not even the manager\'s',
    now: () => 'On. A manager SEES everything but only has his own on his plate.', who: 'Managers and Leads.',
    brk: ['Putting critical mail on the manager\'s plate as well is written and tested (O4) but is not switched on in this build.']
  },

  /* ------------------------------------------------ how a mail gets owner -- */
  {
    id: 'R27', g: 'Ownership', k: 'sw', n: 'Replying takes ownership of mail nobody owns',
    now: v => v ? 'Answering mail nobody has taken makes it yours, and a history line records it.'
      : 'Replying never changes the owner. It makes you a participant, so it stays in your Inbox and your My work.',
    who: 'Everybody who answers team mail.',
    brk: [
      'ON is how Gulab\'s conversation silently became Jagjit\'s on 20 November: the app judged "unassigned" from the copy in THAT browser, so a stale page wrote the replier over the real owner, with nothing in the history to show for it.',
      'ON with R3 also means the conversation leaves the rest of the team the instant you answer it.',
      'OFF leaves mail in Needs owner even after somebody has answered it, so the manager has to tidy up.'
    ]
  },
  {
    id: 'R28', g: 'Ownership', k: 'srv', n: 'Auto-assign, first hit wins: alias, buyer\'s domain, "Hi <name>", who replied last, buddy',
    now: () => 'On, on the office server, and only ever on mail nobody owns.', who: 'Everybody.',
    brk: ['It is switched off for a team the moment that team is made manager-first - see the manager-first list below.',
      'Changing the rules themselves needs a change on the office server.']
  },
  {
    id: 'R29', g: 'Ownership', k: 'fx', n: 'Take, assign and transfer are a person\'s choice, and an auto rule can never overwrite one',
    now: () => 'On. Every auto rule ends "and owner_id is null".', who: 'Everybody.', brk: ['Nothing to change.']
  },
  {
    id: 'R30', g: 'Ownership', k: 'fx', n: 'Mail older than the team\'s go-live never counts as work',
    now: () => 'On. It is still in the Inbox and still searchable - it just adds nothing to anyone\'s list.', who: 'Everybody.',
    brk: ['Off would put a year of history into Needs owner.']
  },
  {
    id: 'C5', g: 'Ownership', k: 'sw', n: 'Everybody may transfer and assign',
    now: v => v ? 'Every active person can transfer a conversation to another team and give it to a colleague.'
      : 'Only a person with the Assign / Transfer tick in Admin -> Users, and every Admin.',
    who: 'Every team member.',
    brk: [
      'On, a member can move a buyer\'s conversation into another team, and there is no undo button for a transfer.',
      'Off is the shipped behaviour and the per-person ticks in Admin -> Users are what decide it.'
    ]
  },

  /* ------------------------------------------------------- everyone else -- */
  {
    id: 'R31', g: 'Roles', k: 'fx', n: 'Admin, Manager and Lead see everything in every mailbox they may open',
    now: () => 'On.', who: 'Admins, Managers, Leads.', brk: ['Off would leave unassigned mail with nobody looking after it.']
  },
  {
    id: 'R32', g: 'Roles', k: 'set', n: 'Manager-first teams - mail nobody has taken is the manager\'s to hand out',
    now: () => { const l = rMgrList(); return l.length ? 'ON for ' + l.join(', ') + '.' : 'OFF for every team. Switched off everywhere on 26 November.'; },
    who: 'The members of whichever team is listed.',
    brk: [
      'The office server reads this same list: a mailbox on it is skipped by EVERY automatic rule (alias, buyer domain, "Hi <name>", trail, buddy), so nothing is handed out automatically any more - only the manager can.',
      'Team Designing was on this list from 20 to 26 November. 3,857 of its 3,873 Inbox conversations had no owner, so six designers saw almost nothing and reported their mail as missing.'
    ]
  },
  {
    id: 'R33', g: 'Roles', k: 'fx', n: 'Critical-only - one person sees just the critical mail of a mailbox',
    now: () => 'Built for Priya on Vinay\'s mailbox. Priya has left, so nobody holds it.', who: 'Nobody at the moment.',
    brk: ['It is in the code keyed to a person id (CRIT_ONLY), so giving it to somebody else is a code change.']
  },
  {
    id: 'R34', g: 'Roles', k: 'fx', n: 'Switch ID shows exactly what that person sees',
    now: () => 'On. Admins only, 8-hour sessions, and every switch is recorded.', who: 'Admins.',
    brk: ['It is the only honest way to check a rule from somebody else\'s point of view.']
  },

  /* --------------------------------------- things that hide mail, not rules */
  {
    id: 'HIDEOLD', g: 'Things that hide mail', k: 'set', n: 'Hide mail from before Go live',
    now: () => { try { return (OLDMAIL.hide_before_live ? 'TICKED - every conversation older than Go live is hidden from every list and every count.' : 'Not ticked, which is how it must stay.'); } catch (e) { return 'Not ticked.'; } },
    who: 'Everybody, in every mailbox.',
    brk: [
      'Ticked, this hides EVERYTHING older than 16 November 10:55 from every list and every count. Search still finds it, which is why it is so hard to spot.',
      'It is the single biggest hider of mail in the app and the first thing to check on any "my mail is missing" report.'
    ]
  },
  {
    id: 'VIEWSHOW', g: 'Things that hide mail', k: 'fx', n: 'The View menu\'s "Show" filter, saved per person',
    now: () => 'Each person\'s own choice: All, Unread, Has attachments, Flagged, @Mentions me or To me. It is remembered for ever.',
    who: 'One person at a time - whoever set it.',
    brk: [
      'This is the most common cause of "my mail is missing". A person who once chose "Unread" sees only unread mail from then on, in every mailbox, and nothing on screen says why.',
      'The checks at the top of this page name anybody whose filter is not "All".'
    ]
  },
  {
    id: 'CHIPS', g: 'Things that hide mail', k: 'fx', n: 'The three chips - Inbox, Unread, Unassigned',
    now: () => 'A chip narrows the list until it is pressed again. Since 25 November a reload no longer brings a chip or a search back.',
    who: 'One person at a time.',
    brk: ['Before 25 November the Open chip and even a stale search came back after a reload, which is what emptied Mala\'s Inbox.']
  },
  {
    id: 'IGNORE', g: 'Things that hide mail', k: 'srv', n: '"Ignore conversation" sends every later mail straight to Deleted',
    now: () => 'On, as a trigger on the office server. "Stop ignoring" from the same menu undoes it.',
    who: 'Whoever ignored it - but it affects the whole team, because the mail is moved for everybody.',
    brk: ['It is the one person-made setting that hides mail from colleagues as well. Worth checking when a whole conversation seems to stop arriving.']
  },
  {
    id: 'DRAW', g: 'Things that hide mail', k: 'fx', n: 'Only the first 150 rows are drawn, the rest arrive as you scroll',
    now: () => 'On (60 rows on a slow PC). The window counts CONVERSATIONS, so it reaches equally far down whichever row model R17 is on.',
    who: 'Everybody.',
    brk: ['This was what made the Inbox and Sent look half-empty on 26 November when per-mail rows were first switched on.']
  },

  /* ---------------------------------- built, tested, not switched on here -- */
  {
    id: 'C1', g: 'Built but not switched on', k: 'off', n: 'Unassigned mail leaves a member\'s Inbox after 30 minutes',
    now: () => 'Written and tested (clock 10:00-18:00, stopped on Sundays and holidays), rolled back with the 26 November outage. It is in server/patch-locked-rules-1.js.',
    who: 'Every team member.',
    brk: ['It is R1 with a clock: the whole team sees new mail for half an hour, then it becomes the manager\'s to hand out.',
      'The holiday list it reads does not exist on the server yet, so today only Sundays are skipped.']
  },
  {
    id: 'C2', g: 'Built but not switched on', k: 'off', n: 'A manager replying takes the conversation over completely',
    now: () => 'Written and tested, not live. In server/patch-locked-rules-1.js.', who: 'Managers and Leads.',
    brk: ['You asked for this by tapping, but your typed note asked for TWO seats - one member and one manager. The two answers disagree, and that is still open.']
  },
  {
    id: 'R16q', g: 'Built but not switched on', k: 'off', n: 'Mail sent under nobody\'s name becomes manager-only',
    now: () => 'Written and tested, not live.', who: 'Every team member.', brk: ['372 messages are affected. See R16.']
  },
  {
    id: 'O4', g: 'Built but not switched on', k: 'off', n: 'Every critical mail in a team is also in that manager\'s My work',
    now: () => 'Written and tested, not live.', who: 'Managers and Leads.', brk: ['Two plates at once, by design. Admins were deliberately left out - nine mailboxes of critical mail is not one person\'s plate.']
  },
  {
    id: 'C3', g: 'Built but not switched on', k: 'off', n: 'A manager is asked "should your team see this?" on every reply',
    now: () => 'Agreed, nothing written yet.', who: 'Managers.', brk: ['Nothing to switch - it does not exist.']
  },
  {
    id: 'C4', g: 'Built but not switched on', k: 'off', n: '"Leave this conversation" leaves a frozen copy at the date you left',
    now: () => 'Agreed, nothing written yet.', who: 'Everybody.', brk: ['Nothing to switch - it does not exist.']
  }
];
function rById(id) { for (let i = 0; i < RULES.length; i++) if (RULES[i].id === id) return RULES[i]; return null; }
const RGROUPS = ['Inbox', 'Sent', 'Needs owner', 'My work', 'Ownership', 'Roles', 'Things that hide mail', 'Built but not switched on'];

/* ======================================================= CONFLICT ENGINE === */
/* rChk(id,next) -> {hard:[],warn:[],eff:[]}
   hard = the change is refused and the reason is shown
   warn = it is allowed, and this is what it will cost
   eff  = what happens the moment it is applied, counted from the mail loaded here        */
function rChk(id, next) {
  const hard = [], warn = [], eff = [];
  const V = k => (k === id ? next : RV(k));
  const nMem = rMembers().length;

  if (id === 'R1') {
    if (next === false) {
      const n = rN(t => !t.owner);
      eff.push(rPlural(n, 'conversation') + ' nobody has taken would leave the Inbox of ' + rPlural(nMem, 'person', 'people') + ' and show only under "Needs owner".');
      const bad = rNoManager();
      if (bad.length) hard.push('In ' + bad.map(d => d.name).join(', ') + ' nobody would be looking after that mail: the team has no Manager and no Lead, so it would reach only the Admin. Give the team a Manager first, or leave this rule on.');
      if (V('R3') === false) warn.push('R3 is off, so members would see mail that belongs to a COLLEAGUE but not mail that belongs to NOBODY. That is the wrong way round and reads as a bug.');
      warn.push('Buyers wait longer: a first mail now sits until the manager hands it out.');
      warn.push('This is the exact change that produced four "my mail is missing" reports on 26 November.');
    } else {
      eff.push(rPlural(rN(t => !t.owner), 'conversation') + ' nobody has taken would appear in every team member\'s Inbox again.');
    }
  }

  if (id === 'R3') {
    if (next === false) {
      const n = rN(t => t.owner && t.owner !== ME);
      eff.push(rPlural(n, 'conversation') + ' that belong to somebody would become visible to everybody in the team.');
      hard.push('This is what was reported and reversed within the hour on 26 November ("now Ashok sees Arun\'s and Ashish\'s mail"). Five people share teampulse@, so every member would read every colleague\'s buyer correspondence.');
      warn.push('Every member\'s unread count becomes the whole mailbox\'s unread count.');
    } else {
      eff.push('Each member\'s Inbox goes back to their own work plus whatever nobody has taken.');
    }
  }

  if (id === 'R7') {
    if (next === false) {
      const n = rN(t => t.status === 'done'), all = rInbox().length;
      eff.push(rPlural(n, 'conversation') + ' of the ' + all + ' now in the Inbox are marked Done and would leave it at once' + (all ? ' (' + Math.round(n * 100 / all) + '% of what people can see)' : '') + '.');
      hard.push('43,296 conversations were marked Done in the 17 November sweep and the whole history of the newest mailboxes arrives Done. Switching this off empties most of the Inbox in one go, and that reads as lost mail to everybody.');
      warn.push('R20 stops being explainable: "1,062 in the Inbox, 11 in Needs owner" is only sensible while Done mail is still visible.');
      try { if (OLDMAIL.hide_before_live) warn.push('"Hide mail from before Go live" is ALSO ticked. Together those two leave almost nothing on screen.'); } catch (e) { }
    } else {
      eff.push(rPlural(rN(t => t.status === 'done'), 'Done conversation') + ' would come back into view in the Inbox.');
    }
  }

  if (id === 'R10' && next === false) {
    eff.push(rPlural(rN(t => typeof isOtp === 'function' && isOtp(t)), 'login-code mail') + ' is loaded here now; each would follow the ordinary rules instead of being shown to everyone.');
    if (V('R1') === false || V('R3') === true || rMgrList().length) {
      hard.push('A login code would reach nobody who needs it. With the rules as they are, a code sent to the team mailbox can sit behind "Needs owner" or inside a colleague\'s private conversation while the person is locked out of the account. Codes expire in minutes.');
    } else {
      warn.push('A code sent to a team mailbox could end up in a conversation somebody else owns.');
    }
    warn.push('Reported on 20 November as "OTP is not showing on email" - three separate rules were hiding them.');
  }
  if (id === 'R10' && next === true) eff.push('Login codes stay visible to everybody in the team and tagged, and still count as nobody\'s work.');

  if (id === 'R11') {
    const n = (() => { try { return rMine().filter(t => typeof isWsNotif === 'function' && isWsNotif(t)).length; } catch (e) { return 0; } })();
    if (next === false) {
      eff.push(rPlural(n, 'Workspace notification') + ' loaded here would move into the Inbox and start being counted as mail.');
      warn.push('Unread counts, Needs owner and the Home numbers all grow by machine-made mail that nobody ever answers.');
      warn.push('They were given their own folder on 14 November precisely because they were drowning the Inbox.');
    } else {
      eff.push(rPlural(n, 'notification') + ' goes back to the 🔔 Workspace notifications folder and out of every count.');
    }
  }

  if (id === 'R17') {
    const convs = rInbox().length;
    if (next === true) {
      let rows = 0; try { rInbox().forEach(t => { rows += Math.max(1, (t.msgs || []).length); }); } catch (e) { }
      eff.push('The list would build about ' + rows + ' rows instead of ' + convs + ' for the same mail, so every mail gets its own name and its own time.');
      warn.push('The browser does roughly four times as much work per draw and holds more in memory. The caps added on 26 November cover it, but an old i3 will feel it.');
      warn.push('This decision has been turned over three times in three days. Say which one you want and leave it alone for a day before judging it.');
    } else {
      eff.push('Back to one row per conversation (' + convs + ' rows), named after whoever wrote last.');
      warn.push('A mail like Aman Singh Verma\'s 25 November 17:34 then has no row of its own - its conversation shows "Manfred Mui, 8:21 pm".');
    }
  }

  if (id === 'R27') {
    if (next === true) {
      eff.push('From then on, answering mail nobody has taken puts your name on it and writes a history line.');
      hard.push('This is how Gulab\'s conversation silently became Jagjit\'s on 20 November. The app judges "nobody owns it" from the copy in THAT browser, so a page loaded before a colleague took the mail writes the replier over the real owner. The repair job for that incident is still the only record of who it belonged to.');
      if (V('R3')) warn.push('R3 is on, so the conversation would also leave every other member\'s Inbox the moment you answer it.');
    } else {
      eff.push('Replying goes back to making you a participant only - it stays in your Inbox and your My work, and the owner does not change.');
      warn.push('Mail somebody has answered can stay in Needs owner until a person actually takes it.');
    }
  }

  if (id === 'C5') {
    if (next === true) {
      const n = PEOPLE.filter(p => p.active !== false && p.role !== 'Admin' && !(p.perm && p.perm.transfer)).length;
      eff.push(rPlural(n, 'person', 'people') + ' who cannot transfer today would be able to move a conversation into another team.');
      warn.push('There is no undo button for a transfer. The mail is not lost, but getting it back means somebody transferring it again.');
      warn.push('The per-person Assign / Transfer ticks in Admin -> Users stop deciding anything while this is on.');
    } else {
      eff.push('Back to the per-person ticks in Admin -> Users, plus every Admin.');
    }
  }

  /* cross-checks that apply to any change */
  if (!rulesSaveable()) warn.push('The office server has not picked up the new setting yet, so this change cannot be saved for everybody. Wait for the server version to reach ' + RULES_SRV_NEED + ' and try again.');
  return { hard: hard, warn: warn, eff: eff };
}

/* manager-first is its own shape (a list of mailboxes), so it has its own check */
function rChkMgr(box, on) {
  const hard = [], warn = [], eff = [];
  const d = DEPTS.filter(x => String(mailOf(x)).toLowerCase() === String(box).toLowerCase())[0];
  const nm = d ? d.name : box;
  if (on) {
    const un = rN(t => d && t.dept === d.id && !t.owner);
    const mem = PEOPLE.filter(p => p.active !== false && d && p.dept === d.id && !['Manager', 'Lead', 'CRM', 'Admin'].includes(p.role)).length;
    eff.push(rPlural(un, 'conversation') + ' nobody has taken in ' + nm + ' would be hidden from ' + rPlural(mem, 'member') + ' and become the manager\'s to hand out.');
    hard.push('The office server reads this same list: EVERY automatic rule (alias, buyer domain, "Hi <name>", who replied last, buddy) stops running for ' + nm + '. Nothing will be handed out by itself any more - only the manager can.');
    const boss = PEOPLE.filter(p => p.active !== false && d && p.dept === d.id && ['Manager', 'Lead', 'CRM'].includes(p.role));
    if (!boss.length) hard.push(nm + ' has no Manager and no Lead, so its unassigned mail would reach nobody but the Admin.');
    else warn.push('All of it lands on ' + boss.map(p => p.name).join(' and ') + '. In Team Designing that meant 3,857 waiting conversations and six designers reporting their mail as missing.');
  } else {
    eff.push(nm + ' goes back to the ordinary rules: mail nobody has taken is seen by the whole team, and the automatic rules start handing it out again.');
  }
  return { hard: hard, warn: warn, eff: eff };
}

/* ====================================================== THE HEALTH CHECKS == */
/* what is wrong RIGHT NOW - the things that make people say "my mail is missing" */
function rHealth() {
  const out = [];
  try {
    if (OLDMAIL.hide_before_live) {
      const n = rMine().filter(t => typeof beforeLive === 'function' && beforeLive(t)).length;
      out.push({ bad: true, t: '"Hide mail from before Go live" is TICKED', d: 'Every conversation older than Go live is out of every list and every count (' + n + ' of the mail loaded here). Untick it in Admin -> Overview -> 🗂 Old mail.' });
    }
  } catch (e) { }
  const bad = rNoManager();
  if (bad.length) out.push({ bad: rMgrList().length > 0 || !RON('R1'), t: rPlural(bad.length, 'team') + ' with no Manager or Lead', d: bad.map(d => d.name).join(', ') + ' — unassigned mail there is only the Admin\'s to hand out. It matters the moment R1 is switched off or the team is made manager-first.' });
  try {
    const f = Object.keys(S.lvOf || {}).filter(k => S.lvOf[k] && S.lvOf[k] !== 'all');
    if (f.length) out.push({ bad: true, t: 'The View ▾ "Show" filter is set for ' + rPlural(f.length, 'person', 'people'), d: f.map(k => (who(k) ? who(k).name : k) + ' (' + S.lvOf[k] + ')').join(', ') + ' — their list hides everything else, in every mailbox, until they set it back to All. This is the commonest cause of "my mail is missing".' });
  } catch (e) { }
  const ml = rMgrList();
  if (ml.length) out.push({ bad: true, t: rPlural(ml.length, 'team') + ' set to manager-first', d: ml.join(', ') + ' — members there see no unassigned mail, AND every automatic assign rule is switched off for that mailbox on the server.' });
  const noppl = DEPTS.filter(d => PEOPLE.filter(p => p.active !== false && p.dept === d.id).length === 0);
  if (noppl.length) out.push({ bad: false, t: rPlural(noppl.length, 'mailbox', 'mailboxes') + ' with nobody in them', d: noppl.map(d => d.name).join(', ') + ' — their mail is only visible to Admins.' });
  /* the list and the five counts must agree */
  try {
    const a = rInbox().filter(t => typeof isInboxMail === 'function' && isInboxMail(t)).length;
    const b = (typeof listRows === 'function') ? 0 : 0;
    if (a === 0 && rInbox().length > 0) out.push({ bad: true, t: 'The Inbox counts say zero while the Inbox has mail', d: 'Something is filtering the counts but not the list, or the other way round. Tell the terminal: "the counts and the list disagree".' });
  } catch (e) { }
  if (!rulesSaveable()) out.push({ bad: false, t: 'The office server has not picked up the Mail rules setting yet', d: 'Until it does, a switch on this page cannot be saved for everybody. It updates itself within ten minutes of a push; look at Admin -> 🖥 Server for the version it is running.' });
  return out;
}

/* can the server store the setting yet? the first failed save turns this off for the session */
const RULES_SRV_NEED = '2026-11-26-h';
let RULES_NOSRV = false;
function rulesSaveable() { return !RULES_NOSRV; }

/* ============================================================== THE PAGE === */
function rulesCSS() {
  if (document.getElementById('rulesCSS')) return;
  const s = document.createElement('style'); s.id = 'rulesCSS';
  s.textContent = [
    '.rlwrap{display:flex;flex-direction:column;gap:14px}',
    '.rlhead{font-size:13px;line-height:1.55}',
    '.rlchk{display:flex;flex-direction:column;gap:6px}',
    '.rlck{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:8px;font-size:12.5px;line-height:1.5;background:rgba(255,80,1,.06);border:1px solid rgba(255,80,1,.25)}',
    '.rlck.ok{background:rgba(20,140,90,.08);border-color:rgba(20,140,90,.25)}',
    '.rlck b{display:block}',
    '.rlgrp{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin:10px 0 2px;font-weight:700}',
    '.rlrow{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.18)}',
    '.rlrow:last-child{border-bottom:0}',
    '.rlid{flex:0 0 52px;font-size:11px;font-weight:700;opacity:.6;padding-top:2px}',
    '.rlmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.rlnm{font-size:13.5px;font-weight:650;line-height:1.35}',
    '.rlnow{font-size:12.5px;line-height:1.5;opacity:.85}',
    '.rlbadge{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;align-self:flex-start}',
    '.rlb-on{background:rgba(20,140,90,.14);color:#0d6b47}',
    '.rlb-off{background:rgba(128,128,128,.16)}',
    '.rlb-fx{background:rgba(60,110,200,.14);color:#2b4f93}',
    '.rlb-srv{background:rgba(140,90,200,.14);color:#5a3b8c}',
    '.rlb-nl{background:rgba(255,160,0,.16);color:#8a5a00}',
    '.rlact{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
    '.rsw{border:1px solid rgba(128,128,128,.4);background:transparent;border-radius:99px;padding:4px 12px;font-size:12px;font-weight:650;cursor:pointer;min-width:74px}',
    '.rsw[aria-pressed="true"]{background:#148c5a;border-color:#148c5a;color:#fff}',
    '.rsw[disabled]{opacity:.5;cursor:default}',
    '.rlmore{font-size:12px;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer;opacity:.75;align-self:flex-start}',
    '.rlexp{font-size:12.5px;line-height:1.55;margin:4px 0 2px;padding:8px 10px;border-radius:8px;background:rgba(128,128,128,.08);display:flex;flex-direction:column;gap:6px}',
    '.rlexp ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}',
    '.rlexp em{opacity:.7;font-style:normal;font-size:11.5px}',
    '.rlcf{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.55}',
    '.rlcf h4{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}',
    '.rlcf ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}',
    '.rlbox{padding:10px 12px;border-radius:9px;border:1px solid}',
    '.rlbox.stop{background:rgba(200,40,40,.07);border-color:rgba(200,40,40,.35)}',
    '.rlbox.warn{background:rgba(255,160,0,.08);border-color:rgba(255,160,0,.35)}',
    '.rlbox.eff{background:rgba(60,110,200,.07);border-color:rgba(60,110,200,.3)}',
    '.rllog{font-size:12px;line-height:1.6}',
    '.rllog div{padding:4px 0;border-bottom:1px solid rgba(128,128,128,.14)}',
    '.rlmb{display:flex;gap:8px;align-items:center;font-size:12.5px;padding:6px 0}',
    '@media (max-width:620px){.rlrow{flex-wrap:wrap}.rlid{flex-basis:100%}.rlact{flex-basis:100%;align-items:flex-start}}'
  ].join('');
  document.head.appendChild(s);
}

let RLOPEN = {};   /* which rules are expanded */

function rBadge(r) {
  if (r.k === 'sw') return '';   /* the switch itself already says On or Off - no second badge */
  if (r.k === 'fx') return '<span class="rlbadge rlb-fx">Built in</span>';
  if (r.k === 'srv') return '<span class="rlbadge rlb-srv">Server</span>';
  if (r.k === 'off') return '<span class="rlbadge rlb-nl">Not live</span>';
  return '<span class="rlbadge rlb-fx">Setting</span>';
}

function rRowHTML(r, canEdit) {
  const on = r.k === 'sw' ? RON(r.id) : null;
  const now = (typeof r.now === 'function') ? r.now(on) : String(r.now || '');
  let act = '';
  if (r.k === 'sw') {
    act = '<button class="rsw" data-rtog="' + r.id + '" aria-pressed="' + on + '"' + (canEdit ? '' : ' disabled title="Only an admin can change a rule"') + '>' + (on ? 'On' : 'Off') + '</button>';
  } else if (r.k === 'fx') { act = '<em style="font-size:11.5px;opacity:.6">no switch</em>'; }
  else if (r.k === 'srv') { act = '<em style="font-size:11.5px;opacity:.6">office server</em>'; }
  else if (r.k === 'off') { act = '<em style="font-size:11.5px;opacity:.6">not in this build</em>'; }
  else if (r.id === 'HIDEOLD') { act = canEdit ? '<button class="btn" data-rold>Open 🗂 Old mail</button>' : ''; }
  else if (r.id === 'R32') { act = canEdit ? '<button class="btn" data-rmgr>Choose teams</button>' : ''; }

  const exp = RLOPEN[r.id] ? ('<div class="rlexp"><b>What it changes if you touch it</b><ul>' + (r.brk || []).map(x => '<li>' + esc(x) + '</li>').join('') +
    '</ul><em>Who it affects: ' + esc(r.who || '-') + '</em></div>') : '';
  return '<div class="rlrow"><span class="rlid">' + esc(r.id) + '</span><div class="rlmid">' +
    '<span class="rlnm">' + esc(r.n) + '</span>' +
    '<span class="rlnow">' + esc(now) + '</span>' +
    '<button class="rlmore" data-rmore="' + r.id + '">' + (RLOPEN[r.id] ? 'Hide the detail' : 'What breaks if this changes?') + '</button>' + exp +
    '</div><div class="rlact">' + rBadge(r) + act + '</div></div>';
}

function rulesHTML(canEdit) {
  rulesCSS();
  const hz = rHealth();
  const nSw = RULES.filter(r => r.k === 'sw').length;
  let h = '<div class="rlwrap"><p class="rlhead">These are the rules that decide <b>who sees which mail</b>. ' +
    'They were read out of the app that is running (' + esc(RULES_BUILD) + '), not written from memory.<br>' +
    (canEdit
      ? '<b>' + nSw + ' of them can be changed here.</b> Changing one changes Rugs Email for everybody — so every change is checked first and tells you what it conflicts with and what it will cost. The rest are built into the app or decided on the office server, and say so.'
      : 'Only an admin can change a rule. This page is here so you can read exactly why a mail is where it is — and quote a rule number when something looks wrong.') + '</p>';

  h += '<section class="box"><h3>Checks right now <span>' + hz.length + '</span></h3>';
  h += hz.length ? '<div class="rlchk">' + hz.map(x => '<div class="rlck' + (x.bad ? '' : ' ok') + '"><span>' + (x.bad ? '⚠️' : 'ℹ️') + '</span><span><b>' + esc(x.t) + '</b>' + esc(x.d) + '</span></div>').join('') + '</div>'
    : '<div class="rlck ok"><span>✓</span><span><b>Nothing is hiding mail by mistake</b>No old-mail switch, no stuck "Show" filter, no manager-first team, and every team has somebody looking after its unassigned mail.</span></div>';
  h += '<p class="lead" style="margin:8px 0 0;font-size:12px">Counted from the ' + (rMine().length) + ' conversations this browser has loaded. Older mail arrives in the background, so a number can grow while you read.</p></section>';

  RGROUPS.forEach(g => {
    const rs = RULES.filter(r => r.g === g);
    if (!rs.length) return;
    h += '<section class="box"><h3>' + esc(g) + ' <span>' + rs.length + '</span></h3><div>' + rs.map(r => rRowHTML(r, canEdit)).join('') + '</div></section>';
  });

  const lg = rLog();
  h += '<section class="box"><h3>Who changed what <span>' + lg.length + '</span></h3>';
  h += lg.length ? '<div class="rllog">' + lg.slice().reverse().slice(0, 40).map(e =>
    '<div><b>' + esc(e.id) + '</b> ' + esc(String(e.from)) + ' → <b>' + esc(String(e.to)) + '</b> · ' +
    esc((who(e.by) ? who(e.by).name : e.by) || 'somebody') + ' · ' + esc(new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) + '</div>').join('') + '</div>'
    : '<p class="lead" style="margin:0;font-size:12.5px">No rule has been changed yet. Everything is as it shipped on 26 November.</p>';
  if (canEdit && RULES.filter(r => r.k === 'sw' && RV(r.id) !== RDEF[r.id]).length)
    h += '<button class="btn warn" data-rreset style="margin-top:10px;width:fit-content">↺ Put every rule back to how it shipped</button>';
  h += '</section></div>';
  return h;
}

/* ------------------------------------------------- the confirm dialog ---- */
function rAsk(id, next) {
  const r = rById(id); if (!r) return;
  const c = rChk(id, next);
  const word = next ? 'ON' : 'OFF';
  let b = '<div class="rlcf">';
  b += '<div><b>' + esc(r.n) + '</b><br><span style="opacity:.8">' + esc((typeof r.now === 'function') ? r.now(next) : '') + '</span></div>';
  if (c.eff.length) b += '<div class="rlbox eff"><h4>What happens the moment you press it</h4><ul>' + c.eff.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.hard.length) b += '<div class="rlbox stop"><h4>⛔ This conflicts with how the rest of the app works</h4><ul>' + c.hard.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.warn.length) b += '<div class="rlbox warn"><h4>⚠️ What it will cost</h4><ul>' + c.warn.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  b += '<div><h4>Who it affects</h4>' + esc(r.who || '-') + '</div>';
  b += '<p style="margin:0;opacity:.7;font-size:12px">The change is saved for everybody and written into "Who changed what" with your name on it. Open pages pick it up within a minute.</p></div>';
  const foot = '<button class="btn pri" data-rno>Leave it as it is</button>' +
    (c.hard.length
      ? '<button class="btn warn" data-ryes>I have read the conflict — change it anyway</button>'
      : '<button class="btn" data-ryes>Change it to ' + word + '</button>');
  const L = dlg('Change ' + id + ' to ' + word + '?', b, foot, true);
  const no = L.querySelector('[data-rno]'); if (no) { no.focus(); no.onclick = () => { L.innerHTML = ''; render(); }; }
  const yes = L.querySelector('[data-ryes]');
  if (yes) yes.onclick = () => { L.innerHTML = ''; rSet(id, next); };
}

/* ------------------------------------------------------------ saving ----- */
function rSet(id, next) {
  const o = rulesObj(), vals = Object.assign({}, o.vals || {}), log = rLog().slice();
  const was = RV(id);
  vals[id] = next;
  log.push({ id: id, from: was ? 'On' : 'Off', to: next ? 'On' : 'Off', by: ME, at: Date.now() });
  const body = { v: 1, vals: vals, log: log.slice(-200) };
  S.settings = S.settings || {}; const back = S.settings[RULES_KEY];
  S.settings[RULES_KEY] = body; render();
  api('saveSetting', { key: RULES_KEY, value: body })
    .then(() => { toast(id + ' is now ' + (next ? 'ON' : 'OFF') + ' for everybody'); render(); })
    .catch(e => {
      S.settings[RULES_KEY] = back;
      if (/unknown setting/i.test(e.message || '')) { RULES_NOSRV = true; toast('Not saved: the office server has not picked up the Mail rules setting yet. It updates itself within ten minutes — try again then.', true); }
      else toast('Not saved: ' + (e.message || 'the server refused it'), true);
      render();
    });
}
function rReset() {
  const o = rulesObj(), log = rLog().slice();
  RULES.filter(r => r.k === 'sw').forEach(r => { if (RV(r.id) !== RDEF[r.id]) log.push({ id: r.id, from: RV(r.id) ? 'On' : 'Off', to: RDEF[r.id] ? 'On' : 'Off', by: ME, at: Date.now() }); });
  const body = { v: 1, vals: {}, log: log.slice(-200) };
  S.settings = S.settings || {}; S.settings[RULES_KEY] = body; render();
  api('saveSetting', { key: RULES_KEY, value: body }).then(() => { toast('Every rule is back to how it shipped on 26 November'); render(); })
    .catch(e => toast('Not saved: ' + (e.message || ''), true));
}

/* --------------------------------------------- manager-first chooser ----- */
function rMgrDlg() {
  const cur = rMgrList();
  const b = '<p style="font-size:13px;line-height:1.55;margin:0 0 10px">In a <b>manager-first</b> team, mail nobody has taken is seen only by the Manager, the CRM and the Admin, and it is theirs to hand out. ' +
    'It also switches off <b>every automatic assign rule</b> for that mailbox on the office server, so nothing is handed out by itself.</p>' +
    '<div>' + DEPTS.map(d => {
      const box = String(mailOf(d)).toLowerCase(), on = cur.indexOf(box) >= 0;
      const un = rN(t => t.dept === d.id && !t.owner);
      const boss = PEOPLE.filter(p => p.active !== false && p.dept === d.id && ['Manager', 'Lead', 'CRM'].includes(p.role)).map(p => p.name);
      return '<div class="rlmb"><button class="rsw" data-rmgrt="' + esc(box) + '" aria-pressed="' + on + '">' + (on ? 'On' : 'Off') + '</button>' +
        '<span><b>' + esc(d.name) + '</b> · ' + esc(box) + '<br><span style="opacity:.75;font-size:12px">' + un + ' waiting for an owner · ' +
        (boss.length ? 'handed out by ' + esc(boss.join(', ')) : '<b style="color:#c22">no Manager or Lead</b>') + '</span></span></div>';
    }).join('') + '</div>';
  const L = dlg('Manager-first teams', b, '<button class="btn pri" data-x2>Close</button>', true);
  const x = L.querySelector('[data-x2]'); if (x) x.onclick = () => { L.innerHTML = ''; render(); };
}
function rMgrAsk(box, on) {
  const c = rChkMgr(box, on);
  let b = '<div class="rlcf">';
  if (c.eff.length) b += '<div class="rlbox eff"><h4>What happens the moment you press it</h4><ul>' + c.eff.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.hard.length) b += '<div class="rlbox stop"><h4>⛔ What this also switches off</h4><ul>' + c.hard.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.warn.length) b += '<div class="rlbox warn"><h4>⚠️ What it will cost</h4><ul>' + c.warn.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  b += '</div>';
  const L = dlg((on ? 'Make ' : 'Stop ') + box + (on ? ' manager-first?' : ' being manager-first?'), b,
    '<button class="btn pri" data-rno>Leave it as it is</button><button class="btn warn" data-ryes>' + (on ? 'Make it manager-first' : 'Switch it off') + '</button>', true);
  const no = L.querySelector('[data-rno]'); if (no) { no.focus(); no.onclick = () => { L.innerHTML = ''; rMgrDlg(); }; }
  const yes = L.querySelector('[data-ryes]');
  if (yes) yes.onclick = () => {
    const cur = rMgrList().filter(x => x !== String(box).toLowerCase());
    if (on) cur.push(String(box).toLowerCase());
    S.settings = S.settings || {}; const back = S.settings.mgr_first_boxes;
    S.settings.mgr_first_boxes = cur;
    const log = rLog().slice(); log.push({ id: 'R32 ' + box, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off', by: ME, at: Date.now() });
    const body = Object.assign({}, rulesObj(), { v: 1, vals: (rulesObj().vals || {}), log: log.slice(-200) });
    S.settings[RULES_KEY] = body;
    L.innerHTML = ''; render();
    api('saveSetting', { key: 'mgr_first_boxes', value: cur })
      .then(() => api('saveSetting', { key: RULES_KEY, value: body }).catch(() => null))
      .then(() => { toast(box + (on ? ' is now manager-first' : ' is no longer manager-first')); render(); })
      .catch(e => { S.settings.mgr_first_boxes = back; toast('Not saved: ' + (e.message || ''), true); render(); });
  };
}

/* ================================================= THE TWO WRAPPED RULES == */
/* R7 and R11 only ever REMOVE mail from a list, so a wrapper is enough - and a wrapper is
   safer here than editing the app, because both are read in several places and the list and
   the five Inbox counts have to agree. Both are applied to inView AND to isInboxMail. */
function rInboxView() { try { return view.type === 'all' || (view.type === 'box' && view.folder === 'inbox'); } catch (e) { return false; } }

/* R7 off: a conversation marked Done leaves the Inbox */
const _ivR7 = inView;
inView = function (t) { if (t && t.status === 'done' && !RON('R7') && rInboxView()) return false; return _ivR7.apply(this, arguments); };
const _imR7 = isInboxMail;
isInboxMail = function (t) { if (t && t.status === 'done' && !RON('R7')) return false; return _imR7.apply(this, arguments); };
const _lrR7 = listRows;
listRows = function () { const r = _lrR7.apply(this, arguments); return (RON('R7') || !rInboxView()) ? r : r.filter(t => !(t && t.status === 'done')); };

/* R11 off: Workspace notifications are ordinary mail again */
const _wsnR11 = isWsNotif;
isWsNotif = function (t) { return RON('R11') ? _wsnR11.apply(this, arguments) : false; };

/* ------------------------------------------------------------- wiring ---- */
/* the Admin tab */
const _paRules = pageAdmin;
pageAdmin = function () {
  if (adminTab === 'rules' && who(ME) && who(ME).role === 'Admin') {
    const waitN = (typeof REPS !== 'undefined' ? (REPS || []) : []).filter(r => !r.done_at).length;
    const tabs = [['overview', 'Overview'], ['depts', 'Departments'], ['users', 'Users & passwords'], ['access', 'Visibility & sharing'], ['rules', '📜 Mail rules'], ['switch', '🔁 Switch ID'], ['probs', '🛠 Problems' + (waitN ? ' (' + waitN + ')' : '')], ['srv', '🖥 Server']];
    return '<div class="page"><h2>Admin</h2><div class="seg" role="tablist">' +
      tabs.map(([k, l]) => '<button class="chip" role="tab" data-atab="' + k + '" aria-pressed="' + (adminTab === k) + '">' + l + '</button>').join('') +
      '</div>' + rulesHTML(true) + '</div>';
  }
  let h = _paRules.apply(this, arguments);
  try {
    const mark = '<button class="chip" role="tab" data-atab="switch"';
    if (h.indexOf(mark) > 0 && h.indexOf('data-atab="rules"') < 0)
      h = h.replace(mark, '<button class="chip" role="tab" data-atab="rules" aria-pressed="false">📜 Mail rules</button>' + mark);
  } catch (e) { }
  return h;
};

/* read-only, for everybody, from the menu under your own name */
function mailRulesDlg() {
  const admin = !!(who(ME) && who(ME).role === 'Admin');
  const L = dlg('📜 Mail rules', rulesHTML(false),
    (admin ? '<button class="btn" data-rgo>Open Admin → Mail rules to change one</button>' : '') + '<button class="btn pri" data-x3>Close</button>', true);
  const x = L.querySelector('[data-x3]'); if (x) x.onclick = () => { L.innerHTML = ''; };
  const g = L.querySelector('[data-rgo]'); if (g) g.onclick = () => { L.innerHTML = ''; app = 'admin'; adminTab = 'rules'; render(); };
}

/* one delegated listener of our own, so the app's big click handler is untouched */
document.addEventListener('click', function (e) {
  const b = e.target.closest ? e.target.closest('[data-rtog],[data-rmore],[data-rreset],[data-rold],[data-rmgr],[data-rmgrt],[data-rules]') : null;
  if (!b) return;
  if (b.dataset.rmore !== undefined && b.dataset.rmore) { RLOPEN[b.dataset.rmore] = !RLOPEN[b.dataset.rmore]; render(); return; }
  if (b.hasAttribute('data-rules')) { mailRulesDlg(); return; }
  if (b.dataset.rtog) {
    if (!(who(ME) && who(ME).role === 'Admin')) { toast('Only an admin can change a rule', true); return; }
    rAsk(b.dataset.rtog, !RON(b.dataset.rtog)); return;
  }
  if (b.hasAttribute('data-rreset')) { if (who(ME) && who(ME).role === 'Admin') rReset(); return; }
  if (b.hasAttribute('data-rold')) { app = 'admin'; adminTab = 'overview'; render(); toast('🗂 Old mail is the panel at the top of Admin → Overview'); return; }
  if (b.hasAttribute('data-rmgr')) { if (who(ME) && who(ME).role === 'Admin') rMgrDlg(); return; }
  if (b.dataset.rmgrt) { if (who(ME) && who(ME).role === 'Admin') rMgrAsk(b.dataset.rmgrt, b.getAttribute('aria-pressed') !== 'true'); return; }
}, false);

/* the entry in the menu under your own name. meMenu writes the pop straight into #layer,
   so the button is put into the DOM afterwards rather than into a string. */
const _mmRules = meMenu;
meMenu = function () {
  const r = _mmRules.apply(this, arguments);
  try {
    const m = document.querySelector('.pop[aria-label="Account"] .menu');
    if (m && !m.querySelector('[data-rules]')) {
      const b = document.createElement('button');
      b.setAttribute('data-rules', '');
      b.textContent = '\u{1F4DC} Mail rules';
      b.title = 'Who sees which mail, and why';
      const anchor = m.querySelector('#mB');
      m.insertBefore(b, anchor || null);   /* the click is caught by the delegated listener above */
    }
  } catch (e) { }
  return r;
};
/* __rules:end */
