// Live "open now" status for GINGER AND SPICE, in Canberra time.
//
// UPDATE EVERY YEAR: add the next year's ACT public holidays to HOLIDAYS and
// move HOLIDAYS_KNOWN_UNTIL forward. After that date the status stops
// guessing about holidays and the page's static "Closed on public holidays"
// note is the only guidance.
// Source to check: https://www.cmtedd.act.gov.au/communication/holidays
// Where a holiday falls on a weekend, both the date and the substitute
// weekday are listed, because the restaurant closes on public holidays.

const TIME_ZONE = 'Australia/Sydney'; // Canberra uses Sydney time (AEST/AEDT)

// Minutes after midnight. Index 0 = Sunday.
const LUNCH = [11 * 60, 14 * 60 + 30];
const DINNER_LATE = [17 * 60, 22 * 60];
const DINNER = [17 * 60, 21 * 60 + 30];
const SESSIONS = [
  [LUNCH, DINNER], // Sunday
  [LUNCH, DINNER], // Monday
  [LUNCH, DINNER], // Tuesday
  [LUNCH, DINNER], // Wednesday
  [LUNCH, DINNER], // Thursday
  [LUNCH, DINNER_LATE], // Friday
  [LUNCH, DINNER_LATE], // Saturday
];

const HOLIDAYS_KNOWN_UNTIL = '2027-12-31';
const HOLIDAYS = new Set([
  // 2026 (remaining)
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day (Saturday)
  '2026-12-28', // Boxing Day substitute
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-08', // Canberra Day
  '2027-03-26', // Good Friday
  '2027-03-27', // Easter Saturday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sunday)
  '2027-04-26', // Anzac Day additional holiday
  '2027-05-31', // Reconciliation Day
  '2027-06-14', // King's Birthday
  '2027-10-04', // Labour Day
  '2027-12-25', // Christmas Day (Saturday)
  '2027-12-26', // Boxing Day (Sunday)
  '2027-12-27', // Christmas Day substitute
  '2027-12-28', // Boxing Day substitute
]);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Current wall-clock date and time in Canberra. Temporal where available;
// Intl.DateTimeFormat elsewhere (Safari), which is enough for reading the clock.
function canberraNow() {
  if (typeof Temporal !== 'undefined') {
    const now = Temporal.Now.zonedDateTimeISO(TIME_ZONE);
    return { date: now.toPlainDate().toString(), weekday: now.dayOfWeek % 7, minutes: now.hour * 60 + now.minute };
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const timeFormat = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const formatTime = (minutes) => timeFormat.format(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

const isHoliday = (date) => date <= HOLIDAYS_KNOWN_UNTIL && HOLIDAYS.has(date);

// Next opening after today, skipping known public holidays.
function nextOpening(today, weekday) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDays(today, offset);
    if (isHoliday(date)) continue;
    const day = WEEKDAYS[(weekday + offset) % 7];
    const when = offset === 1 ? 'tomorrow' : day;
    return `opens ${formatTime(SESSIONS[(weekday + offset) % 7][0][0])} ${when}`;
  }
  return null;
}

export function getOpenStatus(now = canberraNow()) {
  const { date, weekday, minutes } = now;

  if (isHoliday(date)) {
    const next = nextOpening(date, weekday);
    return { state: 'closed', text: `Closed today (public holiday)${next ? ` · ${next}` : ''}` };
  }

  for (const [open, close] of SESSIONS[weekday]) {
    if (minutes >= open && minutes < close) {
      const closingSoon = close - minutes <= 30;
      return {
        state: closingSoon ? 'closing' : 'open',
        text: closingSoon ? `Closing soon · ${formatTime(close)}` : `Open now · until ${formatTime(close)}`,
      };
    }
    if (minutes < open) {
      return { state: 'closed', text: `Closed now · opens ${formatTime(open)} today` };
    }
  }

  const next = nextOpening(date, weekday);
  return { state: 'closed', text: `Closed now${next ? ` · ${next}` : ''}` };
}

function render(element) {
  const status = getOpenStatus();
  element.dataset.state = status.state;
  element.querySelector('[data-open-status-text]').textContent = status.text;
  element.hidden = false;
}

const element = typeof document === 'undefined' ? null : document.querySelector('[data-open-status]');
if (element) {
  render(element);
  // Refresh at the start of each minute; cheap and keeps the text honest.
  const tick = () => {
    render(element);
    setTimeout(tick, 60_000 - (Date.now() % 60_000));
  };
  setTimeout(tick, 60_000 - (Date.now() % 60_000));
}
