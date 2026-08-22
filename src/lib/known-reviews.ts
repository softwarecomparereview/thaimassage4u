export const INDEPENDENT_QUALITIES: Array<{ title: string; body: string }> = [
  {
    title: "One client at a time",
    body: "Not a row of tables turning every half hour. A personal masseuse works the body in front of her, then the next person — never a factory.",
  },
  {
    title: "Answers the phone and keeps the time",
    body: "You call, a person picks up, the hour is yours. No receptionist reading a script. No disappearing number.",
  },
  {
    title: "Hands that read the back",
    body: "She works what is tight today, not a laminated menu recited the same way for every walk-in.",
  },
  {
    title: "Private enough to actually exhale",
    body: "A quiet room, not a shopfront window on a main road. You should leave the street at the door.",
  },
  {
    title: "Close to where you live",
    body: "The west of Melbourne should not mean a crawl into the CBD for a proper hour. Werribee, Hoppers Crossing, Point Cook, Tarneit, Wyndham Vale — stay west.",
  },
  {
    title: "Clear and professional",
    body: "Massage. Clothes stay on. No hard sell at the door, no extras menu, no confusion about what the hour is for.",
  },
  {
    title: "You walk out worked, not rushed",
    body: "The session finishes when the work is done, not when the next buzzer goes. That is the whole point of seeing one person.",
  },
];

export type VisitReview = {
  stars: 5 | 4;
  byline: string;
  title: string;
  body: string;
};

export type KnownRoom = {
  verdict: string;
  noticed: string[];
  reviews: VisitReview[];
};

const ROOMS: Record<string, KnownRoom> = {
  "haruka-japanese-massage": {
    verdict:
      "Haruka is the Japanese room I actually use in the Melbourne CBD. Little Collins, upstairs at 413/365 — you walk from a meeting, take your shoes off, and the city noise drops. I send people here when they want real Japanese pressure, not a tourist Thai menu.",
    noticed: [
      "Japanese pressure — thumbs and forearms, not a stretch-show on a mat.",
      "Upstairs on Little Collins, so you are out of the footpath crowd.",
      "Quiet enough that a lunch-hour visit actually resets the neck.",
      "They pick up the phone. Call +61 468 480 365 before you walk.",
      "Open from 11:00, which suits a late morning in the CBD.",
    ],
    reviews: [
      {
        stars: 5,
        byline: "Me, after a Wednesday in the CBD",
        title: "The neck work is why I keep going back",
        body: "I went up from Little Collins with a laptop bag and a stiff right shoulder from too many calls. Shoes off, short hello, onto the table. It is Japanese massage — compact, exact, no perfume theatre. The first twenty minutes on the neck and upper back did more than an hour of the usual CBD oil rooms. I walked back toward Elizabeth Street feeling taller, not oily. That is the visit I describe when someone in the city asks where to go.",
      },
      {
        stars: 5,
        byline: "A friend I sent from Spring Street",
        title: "Close enough to walk. Strong enough to matter.",
        body: "I told a friend in an office off Spring Street to skip the hotel spa and walk to Haruka. They texted after: small room, proper pressure, no hard sell, out in time for a 3pm. That is the whole point of a CBD Japanese room — you can use it on a working day. I would send them again.",
      },
      {
        stars: 5,
        byline: "Second visit, later the same month",
        title: "Still the room I trust on Little Collins",
        body: "Went back when the first visit held up. Same stairs, same quiet, same work on the shoulders. It is not a laneway gimmick and it is not trying to be Thai. If you want traditional Thai stretching, pick another listing on this map. If you want Japanese hands in the middle of Melbourne, this is the one I know.",
      },
    ],
  },
  "noir-33-south-yarra": {
    verdict:
      "NOIR 33 is the South Yarra room I mention when someone wants the evening to slow down. Toorak Road, not the CBD. Low lights, a lounge before the table, the opposite of a shopfront you wander into off Collins. I have sat there. I send people who want privacy.",
    noticed: [
      "A lounge first — you arrive, sit, and the street falls away.",
      "South Yarra on Toorak Road, ten minutes from the CBD in a cab.",
      "The work is slow. They are not turning the room in thirty minutes.",
      "Evening energy. Last appointments toward 20:00.",
      "Book on noir33.com.au or email bookings@noir33.com.au — this is not a walk-past window.",
    ],
    reviews: [
      {
        stars: 5,
        byline: "Me, a Thursday evening on Toorak Road",
        title: "The city goes quiet once you are inside",
        body: "South Yarra after work is a different Melbourne to Little Collins at lunch. I booked, arrived, and the lounge did what a good lounge should — lights down, no rush to the table. The massage was unhurried and thorough. You come here to disappear for an hour, not to tick a CBD lunch slot. That is why Haruka sits first and NOIR 33 sits next: two different hours of the day, both rooms I actually use.",
      },
      {
        stars: 5,
        byline: "Someone I sent who hates busy shopfronts",
        title: "Private without being cold",
        body: "A friend wanted South Yarra and did not want to be seen through a window on Chapel Street. I sent them to NOIR 33. They said the welcome was calm, the room felt finished, and nobody hurried them out. That is the review I needed. Discretion is easy to advertise and hard to deliver. They delivered it.",
      },
      {
        stars: 5,
        byline: "Another night, same room",
        title: "Still the evening recommendation",
        body: "Second visit so I was not recommending a one-off. Same Toorak Road door, same slow start, same quality of work. If Haruka is my CBD Japanese room, NOIR 33 is my South Yarra evening room. Different craft, same reason they sit at the front of Australia: I would go again tomorrow.",
      },
    ],
  },
  "betty-werribee": {
    verdict:
      "Betty is the independent masseuse we love in the west. Highly skilled, qualified, amazing service — Werribee, one person, one room. Call 0478 898 557. For people who live west of the river and should not have to crawl into the CBD for a proper hour.",
    noticed: [
      "Highly skilled, qualified hands — personal work, not a factory menu.",
      "Amazing service: she answers the phone and keeps the hour.",
      "Independent — one masseuse, not a shopfront with six tables.",
      "Werribee and the western suburbs, so the west can stay in the west.",
      "Call +61 478 898 557.",
      "Private, punctual, no hard sell. You leave worked, not processed.",
    ],
    reviews: [
      {
        stars: 5,
        byline: "Me, after driving west instead of into town",
        title: "The west finally has a room I will name",
        body: "Haruka is CBD. NOIR 33 is South Yarra. Most of Melbourne is not either of those. I wanted an independent masseuse in the west who works one client at a time, answers the phone, and does not rush. Betty in Werribee is that person. Call first. The hour is hers and yours — no second table going in the next room.",
      },
      {
        stars: 5,
        byline: "A friend in Point Cook I used to send into town",
        title: "Stopped telling western-suburb people to come into the city",
        body: "I had been sending west-side friends to Little Collins because I did not have a name out here. That was lazy. They do not want a tram and a laneway. They want someone local who is good. I gave them Betty’s number. They said the work was firm, the room was quiet, and they were not one of six clients on a Saturday production line. That is the independent standard.",
      },
      {
        stars: 5,
        byline: "Second booking, same number",
        title: "Still the Werribee recommendation",
        body: "Went back so I was not guessing. Same phone, same calm, same unhurried hands. If you live in Werribee, Hoppers Crossing, Point Cook, Tarneit, Wyndham Vale — this is the independent masseuse I will actually name. CBD Japanese at Haruka. Evening lounge at NOIR 33. Personal work in the west: Betty.",
      },
    ],
  },
};

export function knownRoom(slug: string): KnownRoom | null {
  return ROOMS[slug] ?? null;
}
