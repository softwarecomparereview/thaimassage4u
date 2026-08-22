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
        body: "South Yarra after work is a different Melbourne to Little Collins at lunch. I booked, arrived, and the lounge did what a good lounge should — lights down, no rush to the table. The massage was unhurried and thorough. You come here to disappear for an hour, not to tick a CBD lunch slot. That is why I put it second on the Australia page, right after Haruka: two rooms I actually use, two different hours of the day.",
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
};

export function knownRoom(slug: string): KnownRoom | null {
  return ROOMS[slug] ?? null;
}
