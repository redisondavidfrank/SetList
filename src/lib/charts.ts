// Bundled chord charts (lyrics with chords over the lines, UG style).
// Keyed by normalized "artist|title" — aliases map alternate artist spellings.
//
// Chart body format:
//   #<key>            → song key (first line only)
//   #Section name     → section header (Verse, Chorus…)
//   any other line    → chord line if EVERY token parses as a chord,
//                       otherwise a lyric line. A chord line renders above
//                       the lyric line that follows it.

export interface Chart {
  keyName: string; // e.g. "G"
  body: string;
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9|]/g, '');

interface ChartDef {
  artist: string;
  title: string;
  aliases?: Array<[string, string]>;
  keyName: string;
  body: string;
}

const DEFS: ChartDef[] = [
  {
    artist: 'Bob Dylan',
    title: "Knockin' on Heaven's Door",
    aliases: [["Guns N' Roses", "Knockin' on Heaven's Door"]],
    keyName: 'G',
    body: `#G
#Verse 1
G                 D                Am
Mama, take this badge from off of me
G                 D                 C
I can't use it anymore
G                 D                Am
It's gettin' dark, too dark to see
G              D              C
I feel like I'm knockin' on heaven's door
#Verse 2
G                 D                Am
Knock-knock-knockin' on heaven's door
G                 D                 C
Knock-knock-knockin' on heaven's door
G                 D                Am
Knock-knock-knockin' on heaven's door
G              D              C
Knock-knock-knockin' on heaven's door
#Verse 3
G                 D                Am
Mama, put my guns in the ground
G                 D                 C
I can't shoot them anymore
G                 D                Am
That cold black cloud is comin' down
G              D              C
I feel like I'm knockin' on heaven's door`,
  },
  {
    artist: 'The Animals',
    title: 'House of the Rising Sun',
    keyName: 'Am',
    body: `#Am
#Verse 1
Am                  C                    D                 F
There is a house in New Orleans, they call the Rising Sun
Am                  C                    E                 E
And it's been the ruin of many a poor boy, and God, I know, I'm one
#Verse 2
Am                  C                    D                 F
My mother was a tailor, she sewed my new blue jeans
Am                  C                    E                 E
My father was a gamblin' man down in New Orleans
#Verse 3
Am                  C                    D                 F
Now the only thing a gambler needs is a suitcase and a trunk
Am                  C                    E                 E
And the only time he's satisfied is when he's on a drunk
#Chorus
Am                  C                    D                 F
Oh, mother, tell your children not to do what I have done
Am                  C                    E                 E
Spend your lives in sin and misery in the House of the Rising Sun`,
  },
  {
    artist: 'The Cranberries',
    title: 'Zombie',
    keyName: 'Em',
    body: `#Em
#Verse 1
Em                 C                 G                  D
Another head hangs lowly, child is slowly taken
Em                 C                 G                  D
And the violence caused such silence, who are we mistaken
Em                 C                 G                  D
But you see, it's not me, it's not my family
Em                 C                 G                  D
In your head, in your head, they are fighting
#Chorus
Em                 C                 G                  D
Zombie, zombie, zombie-ie-ie
Em                 C                 G                  D
What's in your head, in your head, zombie-ie-ie-ie, oh
#Verse 2
Em                 C                 G                  D
Another mother's breakin', heart is takin' over
Em                 C                 G                  D
When the violence causes silence, we must be mistaken
Em                 C                 G                  D
It's the same old theme since 1916
Em                 C                 G                  D
In your head, in your head, they're still fightin'`,
  },
  {
    artist: 'Ben E. King',
    title: 'Stand By Me',
    keyName: 'G',
    body: `#G
#Verse 1
G                    Em                  C                    D
When the night has come and the land is dark
G                    Em                  C                    D
And the moon is the only light we'll see
G                    Em                  C                    D
No, I won't be afraid, oh, I won't be afraid
G                    Em                  C                    D
Just as long as you stand, stand by me
#Chorus
C                    D                    G                    Em
So darlin', darlin', stand by me, oh stand by me
C                    D                    G
Oh stand, stand by me, stand by me
#Verse 2
G                    Em                  C                    D
If the sky we look upon should tumble and fall
G                    Em                  C                    D
Or the mountain should crumble to the sea
G                    Em                  C                    D
I won't cry, I won't cry, no, I won't shed a tear
G                    Em                  C                    D
Just as long as you stand, stand by me`,
  },
  {
    artist: 'Bob Marley & The Wailers',
    title: 'No Woman No Cry',
    aliases: [['Bob Marley', 'No Woman No Cry']],
    keyName: 'C',
    body: `#C
#Verse 1
C                    G                    Am                   F
Said I remember when we used to sit in the government yard in Trenchtown
C                    G                    Am                   F
Ob-observing the hypocrites as they would mingle with the people we call the bad
#Chorus
C                    G                    Am                   F
No, woman, no cry, no, woman, no cry
C                    G                    F                    C
Said I remember when we used to sit in the government yard in Trenchtown
#Verse 2
C                    G                    Am                   F
And then Georgie would make the fire lights, as it was log wood burnin' through the night
C                    G                    Am                   F
Then we would cook cornmeal porridge, of which I'll share with you
#Outro
F                    C                    G
Everything's gonna be all right, everything's gonna be all right`,
  },
  {
    artist: 'The Beatles',
    title: 'Let It Be',
    keyName: 'C',
    body: `#C
#Verse 1
C                    G                    Am                   F
When I find myself in times of trouble, Mother Mary comes to me
C                    G                    F                    C
Speaking words of wisdom, let it be
C                    G                    Am                   F
And in my hour of darkness she is standing right in front of me
C                    G                    F                    C
Speaking words of wisdom, let it be
#Chorus
F                    C                    G                    Am
Let it be, let it be, let it be, let it be
F                    C                    G
Whisper words of wisdom, let it be
#Verse 2
C                    G                    Am                   F
And when the broken-hearted people living in the world agree
C                    G                    F                    C
There will be an answer, let it be
#Chorus
F                    C                    G                    Am
Let it be, let it be, let it be, let it be
F                    C                    G
Whisper words of wisdom, let it be`,
  },
  {
    artist: 'Journey',
    title: "Don't Stop Believin'",
    keyName: 'E',
    body: `#E
#Verse 1
E                    B                    C#m                  A
Just a small town girl, livin' in a lonely world
E                    B                    C#m                  A
She took the midnight train goin' anywhere
E                    B                    C#m                  A
Just a city boy, born and raised in south Detroit
E                    B                    C#m                  A
He took the midnight train goin' anywhere
#Chorus
C#m                  A                    E                    B
A singer in a smoky room, a smell of wine and cheap perfume
C#m                  A                    E                    B
For a smile they can share the night, it goes on and on and on and on
#Chorus
C#m                  A                    E                    B
Strangers waiting, up and down the boulevard
C#m                  A                    E           B
Their shadows searching in the night
C#m                  A                    E           B
Streetlight people, living just to find emotion
C#m                  A                    E           B
Hiding somewhere in the night`,
  },
  {
    artist: 'Ritchie Valens',
    title: 'La Bamba',
    keyName: 'C',
    body: `#C
#Chorus
C                    F                    G                    C
Para bailar la bamba, se necesita una poca de gracia
C                    F                    G                    C
Una poca de gracia pa' mi, una poca de gracia pa' ti
#Verse
C                    F                    G                    C
Arriba y arriba, arriba y arriba, por ti seré, por ti seré, por ti seré
#Chorus
C                    F                    G                    C
Para bailar la bamba, se necesita una poca de gracia
C                    F                    G                    C
Una poca de gracia pa' mi, una poca de gracia pa' ti`,
  },
  {
    artist: 'Lynyrd Skynyrd',
    title: 'Sweet Home Alabama',
    keyName: 'D',
    body: `#D
#Intro
D                    C                    G
D                    C                    G
#Verse 1
D                    C                    G
Big wheels keep on turnin', carry me home to see my kin
D                    C                    G
Singin' songs about the Southland, I miss Alabama once again
D                    C                    G
And I think it's a sin, yes I think it's a sin
#Chorus
D                    C                    G
Sweet home Alabama, where the skies are so blue
D                    C                    G
Sweet home Alabama, lord, I'm comin' home to you
#Verse 2
D                    C                    G
Well, I heard mister Young sing about her, well I heard ol' Neil put her down
D                    C                    G
Well, I hope Neil Young will remember, a southern man don't need him around`,
  },
  {
    artist: 'Bob Marley & The Wailers',
    title: 'Three Little Birds',
    aliases: [['Bob Marley', 'Three Little Birds']],
    keyName: 'A',
    body: `#A
#Verse 1
A                              D
Don't worry about a thing, 'cause every little thing is gonna be all right
A                              D
Singin', don't worry about a thing, 'cause every little thing is gonna be all right
#Verse 2
A                              E
Rise up this mornin', smiled with the risin' sun
A                              E
Three little birds pitch by my doorstep
A                              D
Singin' sweet songs of melodies pure and true
A                              D
Sayin', this is my message to you-ou-ou
#Chorus
A                              D
Don't worry about a thing, 'cause every little thing is gonna be all right
A                              D
Don't worry about a thing`,
  },
];

function bodyKey(def: ChartDef, artist: string, title: string): string {
  void def;
  return normalize(`${artist}|${title}`);
}

/** All charts in "artist — title" form for the home page. */
export const CHART_LIST: Array<{ artist: string; title: string }> = DEFS.map((d) => ({
  artist: d.artist,
  title: d.title,
}));

/** Normalized lookup map. */
const MAP: Record<string, Chart> = {};
for (const d of DEFS) {
  const chart = { keyName: d.keyName, body: d.body };
  MAP[bodyKey(d, d.artist, d.title)] = chart;
  for (const [a, t] of d.aliases ?? []) MAP[bodyKey(d, a, t)] = chart;
}

export function findChart(artist: string, title: string): Chart | undefined {
  return MAP[normalize(`${artist}|${title}`)];
}
