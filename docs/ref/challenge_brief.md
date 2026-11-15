# Challenge brief: Flame in Freefall (NASA Space Apps 2026)

Source file for citations. Sections 1–3 are verbatim copies; cite them as
"Space Apps 2026 challenge page" or "official challenge video". Sections 4–6
are OUR summaries and interpretations: never cite them as NASA's words.

Captured 2026-11-14 by Ziad from https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/
(the page blocks automated access, so it was copied by hand).
Official challenge video (embedded on the challenge page; URL supplied by the author 2026-11-15): https://www.youtube.com/watch?v=AVuEiKxOpc0

## Contents
1. Challenge page text (verbatim)
2. Resources tab (verbatim list of links)
3. Official challenge video transcript (verbatim auto-transcript, with timestamps)
4. Transcript errors (our corrections)
5. Judging and submission rules (from the Judging & Awards Guide, Nov 13 2026)
6. What this means for Flame Frontier (our interpretation)

---

## 1. Challenge page text (verbatim)

Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data
Join the Challenge
DetailsResourcesTeams
Event
2026 NASA Space Apps Challenge
Difficulty
Advanced
Intermediate
Subjects
Space Exploration
For decades, NASA has studied how flames and fire behave in microgravity, gathering a trove of experimental data along the way. That knowledge matters more than ever as humans gear up to return to the Moon and press on to Mars, yet the volume of results makes them hard to find, compare, and understand. Your challenge is to create an interactive, super intelligence (SI) powered dashboard that summarizes, ranks, and interprets those findings to deliver fire safety insights for human space exploration.


BACKGROUND

Fire hazards are extremely dangerous in space exploration! In describing a smoke alarm that went off during the recent Artemis II mission, the commander commented, “[If] you want to get somebody’s attention really quick, make the fire alarm go off in your spacecraft when you’re still about 80,000 miles from home.” Decades earlier, the Apollo 13 crew endured the life-threatening results of an oxygen tank explosion on their way to the Moon. Similarly, a multinational crew survived a fire aboard the Mir space station caused by an oxygen generator failure. In 1967, the Apollo 1 crew died in a pre-launch test when fire erupted in their oxygen-filled spacecraft.

Compared to Earth, flames in free fall (i.e., in microgravity) are often dramatically different because of the absence of buoyancy and thus rising hot gases. Instead of a flickering teardrop, a candle flame becomes a ghostly blue sphere reliant on diffusion for its oxygen.

NASA’s spacecraft fire safety work is focused on prevention, detection, and suppression. Prevention is achieved by controlling ignition sources and through material selection, which depends on understanding flammability limits. To facilitate spacesuit use, an atmosphere with increased oxygen and reduced pressure compared to Earth’s is expected within the planned Moon Base and pressurized rovers. Flammability is highly dependent on oxygen concentration, and air flow is also important in microgravity. Flammability studies focus on solid materials such as fabrics and plastics, as studied in the Burning and Suppression of Solids (BASS and BASS-II) and Spacecraft Fire Safety Demonstration (Saffire-I, -II, and -III) investigations.

Fire detection was tested in microgravity through the Smoke and Aerosol Measurement Experiment studies (SAME and SAME-R). Suppression was studied in the Flame Extinguishment Experiment (FLEX) through dilution of the chamber atmosphere with carbon dioxide and helium, both of which suppress fire.

OBJECTIVES

Results from low-gravity combustion experiments, conducted for example on the International Space Station (ISS), are being made publicly available through NASA's Physical Science Informatics (PSI) database, but the amount of data can be overwhelming. It can be hard to find, harder to compare, and harder yet to interpret.

Your challenge is to build an SI-powered, web-based dashboard that summarizes, ranks, and interprets combustion science investigations to deliver critical foundational insights for fire safety. You may consider enabling users to:

Identify investigations most relevant to the fire safety needs of habitable crew environments, including spacecraft, space stations, bases on the lunar and Martian surfaces, and pressurized rovers.*
Extract data that supports predictive modeling of flammability and fire scenarios in space exploration.
Highlight research that informs the development of next-generation fire safety controls and equipment.
In this challenge, you’ll help turn complex data into clear answers and make the next giant leap a safer one.

Your dashboard could also address potential applications of the PSI data to fire safety on Earth. Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth, and NASA technology has similarly led to improvements in terrestrial smoke detection and firefighter gear, including protective clothing and air tanks.

*Fire safety involving rockets and propellants is generally beyond the scope of the research available in the PSI database. The high velocities within rocket engines render the combustion effectively independent of gravity — although a rocket’s launch is of course strongly dependent on gravity.

POTENTIAL CONSIDERATIONS

You may (but are not required to) consider the following:

Your target audience can include professors, graduate students, undergraduate students, aerospace researchers, and aerospace engineers.
Consider how you might summarize and display attributes such as:
Experimental objectives
Fuels, including shape and size of the samples or burners
Other test conditions, such as oxygen concentration and airflow speed
Variables: how did tests from the same investigation differ and how were they the same?
Sensors or types of measurements
Consider how to summarize and display similarities and differences between different investigations.
Other investigations in PSI
One of the instruments used for smoke detection in the SAME and SAME-R studies was instead used to detect dust in the Dust and Aerosol Measurement Feasibility Test (DAFT and DAFT-2) studies.
While it burned gaseous fuels, the Burning Rate Emulator (BRE) experiment of the Advanced Combustion via Microgravity Experiments (ACME) project was a study of materials flammability in still atmospheres as a function of material properties.
Other combustion investigations within the PSI database (but not explicitly referenced above) are still relevant to fire safety, just not as strongly or directly.
Hardware
The six experiments in the ACME project featured flames of gaseous fuels and were all conducted with the same modular set of ACME hardware in the Combustion Integrated Rack (CIR).
FLEX, FLEX-2, and the Cool Flames Investigation (CFI) each featured burning droplets of liquid fuel and were conducted with the Multi-user Droplet Combustion Apparatus (MDCA) in the CIR.
BASS, BASS-II, the Smoke Point In Co-flow Experiment (SPICE), and the Structure & Liftoff In Combustion Experiment (SLICE) collectively featured both solid and gaseous fuels. Each of these investigations was conducted within the Microgravity Science Glovebox (MSG) using the modular fan-driven flow duct built for SPICE.
Spacesuits and oxygen concentration
To enable flexibility, spacesuits are filled with 100% oxygen to only 4.3 psi (pounds per square inch), where the Earth’s pressure at sea level is 14.7 psi.
To avoid the bends (decompression sickness), the astronauts pre-breathe 100% oxygen to expel absorbed nitrogen.
To reduce the pre-breathing duration and thus facilitate lunar excursions, it is expected that the Moon Base and pressurized rover(s) will be at a pressure and oxygen concentration between those in a spacesuit and the Earth’s atmosphere.
The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less. Compared to Earth’s atmosphere, that’s more than a 40% increase in the oxygen concentration making materials much more flammable.
Microgravity tests with the highest oxygen concentrations were conducted as part of the ACME’s Cool Flames Investigation with Gases (CFI-G). In those tests, the combustion chamber was filled with a mixture of nitrogen and a flammable gas (e.g., propane), while an oxygen-nitrogen mixture of up to 85% oxygen flowed from the spherical burner creating an inside-out flame.
Partial-gravity data
Although NASA is heavily focused on the return of astronauts to the Moon’s surface and the establishment of a Moon Base in preparation for the future human exploration of Mars, there is currently no partial-gravity combustion data available in PSI. We expect such data will be added in the future, for example from the Lunar-g Combustion Investigation (LUCI) and the Flammability of Materials on the Moon (FM2) experiment.
Partial gravity was mimicked in ACME’s Electric-Field Effects on Laminar Diffusion Flames (E-FIELD Flames) experiment through the effect of the electric field on the ions that naturally occur in flames.
Microgravity and normal-gravity results could bound what occurs at intermediate gravity levels.
For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.

---

## 2. Resources tab (verbatim)

NASA DATA & RESOURCES
- PSI Data Repository: Combustion Science — https://psi.nasa.gov/physci/repo/search?q=combustion — "Physical Sciences Informatics (PSI) source of the data upon which the NASA Space App is to be based."
- NASA Combustion Science — https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/ — "Basic information about most of the combustion investigations for which data is found in the PSI Data Repository."
- NASA ScienceCasts: The Power of Studying Combustion on the ISS — https://www.youtube.com/watch?v=W1oXykoz9zg — "Introduction to NASA's combustion research on the International Space Station through a 3.6-minute video clip from 2018."
- A Researcher's Guide to International Space Station Combustion Science — https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/ — "A 2015 review of NASA's combustion research conducted on, or planned for, the International Space Station. Basic information about most of the combustion investigations described in this 50+ page document is found within the PSI Data Repository."
- Apollo 1 — https://sma.nasa.gov/sma-disciplines/accllp/apollo-1
- Apollo 13 — https://sma.nasa.gov/sma-disciplines/accllp/apollo-13
- 25 Years Ago: Fire Aboard Space Station Mir — https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/
- Fireman's Air Tanks — https://spinoff.nasa.gov/node/9582 — "1970s adaptation of spacesuit technology to improve firefighters' air tanks and breathing gear."
- Fire Detector — https://spinoff.nasa.gov/node/9407 — "1970s smoke detector developed for the shuttle that, discriminating between smoke and dust, results in less nuisance alarms. As such, it has industrial applications (e.g., in mining operations)."
- New Technology for the Fire Attire — https://spinoff.nasa.gov/node/9918 — "1980s application of NASA spacesuit technology to improve firefighter clothing."

Page note (verbatim): "NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites."

---

## 3. Official challenge video transcript (verbatim auto-transcript)

Speakers (names as auto-transcribed; spelling unverified): NASA HQ program scientist for physical sciences; a UC Irvine subject-matter expert; the PSI lead scientist at Marshall Space Flight Center; a Case Western Reserve subject-matter expert.

[0:04] Hi, I'm Tracy Prader and I'm the program scientist for physical sciences at NASA headquarters. I'm part of the team who helped develop the flames in freef fall
[0:12] challenge. Fires are extremely dangerous, especially [music] in space exploration. Imagine you're on a space mission and you're 239,000
[0:21] m from the Earth in a confined space [music] when you hear a fire alarm. To help avoid that scenario, NASA's been
[0:28] conducting research on fire in space for [music] decades, and much of that data is housed within the physical sciences informatics database, [music] which
[0:36] you'll be using for this challenge. In microgravity, we don't have buoyancy driven convection. This means hot air doesn't rise and cold air doesn't sink
[0:45] [music] the way it does on Earth. This creates a different thermal environment and [music] thus flame characteristics, ignition, propagation, and
[0:53] extinguishment can be quite different than in [music] normal gravity. You'll hear more about that later in this video. As NASA goes back to the lunar
[1:02] [music] surface, this time to stay and establish a long-term presence there, we need to understand the behavior of flames [music] in a partial gravity
[1:09] environment. We anticipate habitats on the lunar surface will have increased oxygen levels which [music] mitigates the risk of crew experiencing
[1:17] decompression sickness aka the bins and enables them to conduct more frequent activities on the moon and space suits.
[1:24] However, [music] this enhanced oxygen and partial gravity environment also has implications for flammability of materials. By helping
[1:33] NASA look at our existing data sets in new ways, you can help us on our journey to explore farther while also keeping
[1:40] crews safe. The data sets we have can inform fire safety protocols, design of fire suppression systems, and how we
[1:48] screen materials to assess the risk of fire in various [music] environments.

### Chapter 2: Microgravity flame behavior

[1:54] Welcome, welcome. My name is Uchian Alice Chan, the [music] director of lasers, flames, and aerosols research group from the mechanical and aerospace
[2:03] engineering department [music] at the University of California, Irvine.
[2:08] I'm a subject matter expert [music] for the flame in freef fall challenge.
[2:14] NASA has been studying how different types of fuels including [music] gaseous, liquid and solid fuels burn in
[2:21] low-gravity environment under different atmospheric [music] conditions. And these microgravity flames have been studied using drop towers, [music]
[2:30] parabolic flight, sounding rocket, suborbital flights, and through the missions to the ISS.
[2:37] Now, let's see what flames look like in microgravity. Let's take a candle flame as an example.
[2:46] On Earth, buoyancy causes hot gases to rise, [music] given its flame, familiar tear drop shape and carrying the suit
[2:55] upwards, making the flame yellow. In microgravity, buoyancy is greatly reduced. [music] The flame becomes more
[3:03] spherical, sfree, and blue because the hot gases no longer rise [music] as they do on Earth. The flame also does not
[3:12] flicker in the same way as it does on Earth.
[3:18] Another striking example is NASA's microgravity e-ill flames experiment. An electric field drags flam
[3:25] [music]
[3:25] ions in the spherical flame creating ion driven wind [music] and it transform it into a teardropshaped flames [music] even in microgravity.
[3:39] This acrylic rod burns in a fan driven flow during the best two microraph [music] experiment
[3:47] and the melting acrylic bubbles create irregular features of [music] the flame.
[3:53] This is a B gaseous burner which uses a porous burner for flammability and [music] extinction in low gravity.
[4:03] To sum up, microgravity flames can look dramatically different from the flames on Earth [music] because the buoyancy is greatly reduced.
[4:15] Now, let's look at the data.

### Chapter 3: Accessing NASA PSI data

[4:18] Hello and welcome to the NASA Space App Challenge. My name is Shubha Yusen and I work at the Marshall Space Flight Center
[4:26] serving as the lead scientist for a NASA physical science data repository known as physical science informatics or PSI
[4:34] for short. By now you must have read all about this specific combustion related
[4:40] space challenge. Over the last couple of decades, NASA has been performing significant investigations in the area
[4:49] of combustion science, showing how a flame behaves very differently in a microgravity environment compared to that of Earth.
[5:00] This has generated a large volume of data. Sometimes for a user looking for a specific investigation or a specific
[5:09] data set this might be a little overwhelming and confusing. Equally important it might be difficult to
[5:17] interpret the data such that such that they can design the next generation of spacecrafts or even habitats on the
[5:26] lunar surface that are safer from a fire safety standpoint. [music]
[5:32] Best way to get to PSI is to just type in psi.mnasa.gov and it takes you [music] to the psi web link and the data repository from there.
[5:44] Alternately, you can just scan in the QR code. Once you are there, you'll notice that there are six different areas of
[5:52] physical sciences. You select combustion science and you will see 24 investigations with 12 terabytes of
[5:59] data. That in itself is a large volume of data and that is why we need your help with your app. Once you click on
[6:07] one of these investigations, it will give you the overview of that specific investigation such as the objectives and the approach and also on
[6:17] the left you will see a number of folders containing the important scientific data sets and the scientific
[6:24] documents. [snorts] For example, if you click on data files and documents, it'll take you to a folder where you will
[6:31] notice that a number of samples were tested under the reduced gravity environment and each of them have a
[6:39] folder of its own with scientific data in them. Also important are the publications. The ones marked in blue
[6:48] each have their own DOI which can take you directly to the journal publication website where you can either read the
[6:56] entire publication or at least get an abstract. Hello everyone. My name is Yatin Leo.

### Chapter 4: Challenge goals and impact

[7:03] I'm an associate professor in the department of mechanical and aerospace engineering at Case Western Research University. I am a subject matter expert for the flame in freef fall challenge.
[7:16] Okay, this is the challenge for you [music] to build an SI powered web-based dashboard that summarizes ranks and
[7:24] interprets the results of conduction investigations to deliver fire safety insights. [music] Your tool should enable users to first
[7:33] identify investigations most relevant to [music] the fire safety needs of habitable crew environment. Second,
[7:40] extract data that supports predictive modeling of flammability and fire scenarios in space explorations.
[7:48] And third, highlight research that informs the development of next generation fire safety controls and equipment.
[7:57] Here is challenge [music] add-on for earth applications. Your dashboard could also address potential applications of the PSI data to fire [music] safety on Earth. Here are some examples.
[8:09] The fine water mint extinguishers [music] originally developed for use on the ISS have practical application here
[8:16] [music] on Earth. Similarly, some NASA technology has led to [music]
[8:21] improvements in intellectual smoke detection and firefighter gear including protective closing air tank etc.
[8:30] Together, [music] let's turn complex data into clear answers and make NASA's next giant leap a safer one.

---

## 4. Transcript errors (our corrections; the verbatim text above is unchanged)

| Transcript says | Means | Confidence |
|---|---|---|
| "flames in freef fall" | Flame in Freefall | certain |
| "the bins" | the bends (decompression sickness) | certain |
| "carrying the suit upwards" | carrying the soot upwards | certain |
| "sfree" | soot-free | certain |
| "e-ill flames experiment" | ACME E-FIELD Flames | certain (matches challenge page) |
| "best two microraph experiment" | BASS-II microgravity experiment | likely |
| "a B gaseous burner which uses a porous burner" | BRE (Burning Rate Emulator) gaseous burner | likely (matches challenge page) |
| "psi.mnasa.gov" | psi.nasa.gov | certain |
| "conduction investigations" | combustion investigations | certain |
| "fine water mint" | fine water mist | certain |
| "intellectual smoke detection" | industrial (or terrestrial) smoke detection | uncertain |
| "protective closing" | protective clothing | certain |
| "Case Western Research University" | Case Western Reserve University | certain |
| "239,000 m from the Earth" | ~239,000 miles (Earth–Moon distance) | likely |

---

## 5. Judging and submission rules (Judging & Awards Guide, dated Nov 13 2026)

Each criterion is scored 1–5 at every level (local, global, executive):
- **Impact**: size of the problem addressed and reach of the effect.
- **Creativity**: originality; a novel concept or a meaningful improvement on existing ideas.
- **Validity**: grounded in scientific principles; technically feasible; usable and user-friendly.
- **Relevance**: fully addresses the challenge; "meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition."
- **Presentation**: clear, engaging storytelling of the challenge, solution and significance. "Judges evaluate the demo and full project to compute this score." The guide stresses giving presentation equal attention.

Submission minimums for Global Judging:
- Respond to an official challenge. All team members registered for the same Local Event and on the team's Members tab; members cannot be added after submission closes. Local Event teams: 1–6 people.
- All required fields on the Project Submission page completed.
- A short demo: slides (max 7, including title and intro) OR a video (max 30 seconds). English, or English subtitles.
- Submit before Sunday Nov 15, 11:59 pm local time (our local deadline is 6:00 pm NST).
- Tick: agree to the submission requirements, Terms and Privacy Policy.
- Tick: the project is original work, and ALL external resources (code, text, images, even open source or freely available) are listed in the References field; no copyrighted material used without permission.

Judging timeline (matters for hosting, API key expiry and offline mode):
- Global Nominees announced **Dec 3, 2026**.
- Global Finalists announced **Dec 17, 2026**.
- Global Winners announced **Jan 26, 2027**.
- So the live site must keep working, without a live API key if necessary, until at least late January 2027.

Global award categories that fit this project: Best Use of Data ("makes space data accessible"), Best Use of Science ("most valid use of the scientific method"), Best Storytelling.

---

## 6. What this means for Flame Frontier (OUR interpretation, not NASA's words)

The three user capabilities the brief and video both name (map every product feature to one of these):
1. **Identify** investigations most relevant to fire safety in crewed habitats: spacecraft, space stations, lunar and Martian surface bases, pressurized rovers.
2. **Extract** data that supports predictive modelling of flammability and fire scenarios.
3. **Highlight** research that informs next-generation fire safety controls and equipment (prevention, detection, suppression).
- Optional add-on: Earth fire-safety applications (spinoffs listed in section 2).

Attributes the brief suggests displaying (our catalog schema should cover these):
objectives; fuels, including sample/burner shape and size; test conditions such as O2 concentration and airflow speed; variables (how tests within an investigation differed and stayed the same); sensors/measurement types; similarities and differences between investigations.

Target audience named in the brief: professors, graduate and undergraduate students, aerospace researchers and engineers. Write for technical readers; units always shown.

Investigations the brief names, by fire-safety role (from section 1):
- Prevention / material flammability (solids): BASS, BASS-II, Saffire-I, -II, -III. Also ACME BRE (gas burner emulating material flammability in still air).
- Detection: SAME, SAME-R (instrument reused for dust in DAFT, DAFT-2).
- Suppression: FLEX (CO2 and helium dilution). FLEX, FLEX-2 and CFI used droplets in the MDCA/CIR.
- Hardware families: ACME = 6 gaseous-flame experiments in the CIR; FLEX/FLEX-2/CFI = droplets in MDCA/CIR; BASS/BASS-II/SPICE/SLICE = solids and gases in the MSG flow duct.
- Highest O2 in microgravity: ACME CFI-G, up to 85% O2 (gas flames, inside-out spherical burner; not solid materials).
- Partial gravity: none in PSI. Future sources: LUCI, FM2. E-FIELD Flames mimicked partial gravity with electric fields. Micro- and normal-gravity results can bound intermediate gravity.
- Out of scope per the brief: rockets and propellants.

Atmosphere numbers stated in the brief (cite section 1):
- Spacesuit: 100% O2 at 4.3 psi. Sea level: 14.7 psi.
- Moon base and pressurized rovers: likely 30% O2 or greater, at 10.2 psi or less; "more than a 40% increase in the oxygen concentration."
- The video adds: lunar habitats will have increased O2 to reduce decompression-sickness risk and allow more frequent EVAs; this plus partial gravity changes material flammability; the data should inform fire safety protocols, suppression system design, and material screening.

Microgravity flame appearance (video, 2:37–3:12): on Earth, a teardrop shape, yellow from soot carried upward, flickering; in microgravity, more spherical, soot-free, blue, no flicker in the same way.

"SI" in the challenge title means "super intelligence" (an AI-powered dashboard).
