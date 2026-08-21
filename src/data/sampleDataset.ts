import { RawRow } from '../types';

/**
 * 321 realistic registration records modeled after the AIROX'26 symposium database,
 * containing all authentic edge cases:
 * - Technical: "The FinalHire", "The Final Hire", "THE FINAL HIRE", "The  Final   Hire", "Zero Hour", "Paper Presentation", "The Prompt League"
 * - Non-Technical: "AD SHOT", "Ad Shot", "AD  SHOT", "AD BATTLE" (legacy entry error), "GOATED OR GHOSTED", "Goated  Or  Ghosted", "CLASH AND CONQUER", "BOX CRICKET", "ESPORTS (FREE FIRE & STUMBLE GUYS)"
 * - Multi-event cells: "AD SHOT, GOATED OR GHOSTED", "The Final Hire, Zero Hour", "CLASH AND CONQUER, BOX CRICKET"
 */
export const SAMPLE_AIROX26_RAW_DATA: RawRow[] = [
  {
    "Registration ID": "AIR001",
    "Full Name": "Arun Kumar M",
    "Email Address": "arunkumar.m@gmail.com",
    "Mobile Number": "9840123456",
    "College / Institution": "J.J. College of Engineering and Technology (JJCET)",
    "Technical Events": "The Final Hire, Zero Hour",
    "Non-Technical Events": "GOATED OR GHOSTED",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR002",
    "Full Name": "Priya Sundaram",
    "Email Address": "priya.sundaram@sastra.ac.in",
    "Mobile Number": "9443210987",
    "College / Institution": "SASTRA Deemed University",
    "Technical Events": "The Prompt League",
    "Non-Technical Events": "AD SHOT, GOATED OR GHOSTED",
    "How will you participate?": "Team",
    "Team Name": "WebCrafters",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR003",
    "Full Name": "Karthik Raja S",
    "Email Address": "karthik.raja@nitt.edu",
    "Mobile Number": "9876543210",
    "College / Institution": "National Institute of Technology, Trichy",
    "Technical Events": "Paper Presentation",
    "Non-Technical Events": "BOX CRICKET",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR004",
    "Full Name": "Sneha Venkatesh",
    "Email Address": "sneha.v@srmist.edu.in",
    "Mobile Number": "9123456780",
    "College / Institution": "SRM Institute of Science and Technology",
    "Technical Events": "Zero Hour",
    "Non-Technical Events": "CLASH AND CONQUER",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Pending"
  },
  {
    "Registration ID": "AIR005",
    "Full Name": "Vigneshwaran P",
    "Email Address": "vignesh.p@psgtech.ac.in",
    "Mobile Number": "9345678901",
    "College / Institution": "PSG College of Technology",
    "Technical Events": "Paper Presentation, The Final Hire",
    "Non-Technical Events": "ESPORTS (FREE FIRE & STUMBLE GUYS)",
    "How will you participate?": "Team",
    "Team Name": "RoboTitans",
    "Verification Status": "Verified"
  },
  // CRITICAL NON-TECH LEGACY ALIAS: "AD BATTLE" -> AD SHOT
  {
    "Registration ID": "AIR006",
    "Full Name": "Deepika Natarajan",
    "Email Address": "deepika.n@ssn.edu.in",
    "Mobile Number": "9567890123",
    "College / Institution": "SSN College of Engineering",
    "Technical Events": "The Prompt League",
    "Non-Technical Events": "AD BATTLE",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR007",
    "Full Name": "Dinesh Babu R",
    "Email Address": "dinesh.babu@annauniv.edu",
    "Mobile Number": "9789012345",
    "College / Institution": "CEG, Anna University",
    "Technical Events": "Zero Hour",
    "Non-Technical Events": "BOX CRICKET, CLASH AND CONQUER",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR008",
    "Full Name": "Harini Krishnan",
    "Email Address": "harini.k@tce.edu",
    "Mobile Number": "9890123456",
    "College / Institution": "Thiagarajar College of Engineering",
    "Technical Events": "The Final Hire",
    "Non-Technical Events": "Ad Shot",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR009",
    "Full Name": "Manoj Kumar G",
    "Email Address": "manoj.g@cit.edu.in",
    "Mobile Number": "9678901234",
    "College / Institution": "Coimbatore Institute of Technology",
    "Technical Events": "The Prompt League",
    "Non-Technical Events": "Clash and Conquer, Box Cricket",
    "How will you participate?": "Team",
    "Team Name": "FF Firestorm",
    "Verification Status": "Pending"
  },
  {
    "Registration ID": "AIR010",
    "Full Name": "Ananya Ramesh",
    "Email Address": "ananya.r@vit.ac.in",
    "Mobile Number": "901234678",
    "College / Institution": "Vellore Institute of Technology",
    "Technical Events": "Paper Presentation",
    "Non-Technical Events": "Goated or Ghosted",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR011",
    "Full Name": "Naveen Chandran",
    "Email Address": "naveen.c@kct.ac.in",
    "Mobile Number": "9123450987",
    "College / Institution": "Kumaraguru College of Technology",
    "Technical Events": "Zero Hour, Paper Presentation",
    "Non-Technical Events": "BOX CRICKET",
    "How will you participate?": "Team",
    "Team Name": "BotStrikers",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR012",
    "Full Name": "Divya Bharathi",
    "Email Address": "divya.b@gct.ac.in",
    "Mobile Number": "9234561098",
    "College / Institution": "Government College of Technology, Coimbatore",
    "Technical Events": "The Final Hire",
    "Non-Technical Events": "AD  SHOT",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Rejected"
  },
  {
    "Registration ID": "AIR013",
    "Full Name": "Gokul Nath V",
    "Email Address": "gokul.nath@mitindia.edu",
    "Mobile Number": "9345672109",
    "College / Institution": "Madras Institute of Technology",
    "Technical Events": "The Prompt League, Zero Hour",
    "Non-Technical Events": "Free Fire & Stumble Guys",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR014",
    "Full Name": "Keerthana M",
    "Email Address": "keerthana.m@skcet.ac.in",
    "Mobile Number": "9456783210",
    "College / Institution": "Sri Krishna College of Engineering & Tech",
    "Technical Events": "Paper Presentation",
    "Non-Technical Events": "AD SHOT",
    "How will you participate?": "Team",
    "Team Name": "CreativePulse",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR015",
    "Full Name": "Suresh Raina K",
    "Email Address": "suresh.k@stjosephs.ac.in",
    "Mobile Number": "9567894321",
    "College / Institution": "St. Joseph's College of Engineering",
    "Technical Events": "The Final Hire",
    "Non-Technical Events": "Box Cricket",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR016",
    "Full Name": "Abinaya Selvaraj",
    "Email Address": "abinaya.s@srmvalliammai.ac.in",
    "Mobile Number": "9678905432",
    "College / Institution": "SRM Valliammai Engineering College",
    "Technical Events": "Zero Hour",
    "Non-Technical Events": "Clash & Conquer",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Pending"
  },
  {
    "Registration ID": "AIR017",
    "Full Name": "Praveen Raj T",
    "Email Address": "praveen.t@sairam.edu.in",
    "Mobile Number": "9789016543",
    "College / Institution": "Sri Sairam Engineering College",
    "Technical Events": "The Prompt League",
    "Non-Technical Events": "ESPORTS (FREE FIRE & STUMBLE GUYS)",
    "How will you participate?": "Team",
    "Team Name": "Sairam Hawks",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR018",
    "Full Name": "Meenakshi Sundaram",
    "Email Address": "meenakshi.s@rmkec.ac.in",
    "Mobile Number": "9890127654",
    "College / Institution": "RMK Engineering College",
    "Technical Events": "Paper Presentation",
    "Non-Technical Events": "Goated  Or  Ghosted",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  // CRITICAL TECHNICAL EDGE CASE: "The FinalHire" (no space)
  {
    "Registration ID": "AIR019",
    "Full Name": "Rajesh Kannan E",
    "Email Address": "rajesh.kannan@jjcet.ac.in",
    "Mobile Number": "9901238765",
    "College / Institution": "J.J. College of Engineering and Technology (JJCET)",
    "Technical Events": "The FinalHire",
    "Non-Technical Events": "GOATED OR GHOSTED",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  },
  {
    "Registration ID": "AIR020",
    "Full Name": "Kavitha Balan",
    "Email Address": "kavitha.b@svce.ac.in",
    "Mobile Number": "9012349876",
    "College / Institution": "Sri Venkateswara College of Engineering",
    "Technical Events": "Prompt Craft",
    "Non-Technical Events": "ad battle",
    "How will you participate?": "Individual",
    "Team Name": "",
    "Verification Status": "Verified"
  }
];

const collegesList = [
  "J.J. College of Engineering and Technology (JJCET)",
  "SASTRA Deemed University, Thanjavur",
  "National Institute of Technology, Trichy (NITT)",
  "SRM Institute of Science and Technology, Kattankulathur",
  "PSG College of Technology, Coimbatore",
  "SSN College of Engineering, Chennai",
  "College of Engineering Guindy (CEG), Anna University",
  "Thiagarajar College of Engineering, Madurai",
  "Coimbatore Institute of Technology (CIT)",
  "Vellore Institute of Technology (VIT), Chennai",
  "Kumaraguru College of Technology (KCT)",
  "Government College of Technology (GCT), Coimbatore",
  "Madras Institute of Technology (MIT), Chromepet",
  "Sri Krishna College of Engineering & Technology",
  "St. Joseph's College of Engineering, Chennai",
  "SRM Valliammai Engineering College",
  "Sri Sairam Engineering College, Chennai",
  "RMK Engineering College",
  "Sri Venkateswara College of Engineering (SVCE)",
  "Bannari Amman Institute of Technology (BIT)",
  "Kongu Engineering College, Perundurai",
  "Mepco Schlenk Engineering College, Sivakasi",
  "Rajalakshmi Engineering College (REC)",
  "K.L.N. College of Engineering",
  "Saranathan College of Engineering, Trichy",
  "Care College of Engineering, Trichy",
  "K. Ramakrishnan College of Technology (KRCT)",
  "M.A.M. College of Engineering, Trichy"
];

const firstNames = [
  "Aravind", "Balaji", "Chandru", "Dharshini", "Elango", "Fathima", "Gowtham", "Hariharan",
  "Ishwarya", "Jeeva", "Karthika", "Lokesh", "Mithun", "Nithya", "Omprakash", "Pavithra",
  "Raghavan", "Santhosh", "Tharun", "Uma", "Varun", "Yogesh", "Zoya", "Ajith", "Bharath",
  "Charan", "Divakar", "Eswar", "Farhan", "Gayathri", "Hemalatha", "Iniyan", "Jagan", "Kiruthika",
  "Madhavan", "Nandhini", "Pradeep", "Rohit", "Surya", "Tamilselvan", "Vasanth", "Yuvan"
];

const lastNames = [
  "Kumar", "Rajan", "Sharma", "Natarajan", "Murugan", "Subramanian", "Iyer", "Venkatesan",
  "Pillai", "Sundar", "Ganesan", "Chidambaram", "Anand", "Pandian", "Reddy", "Menon",
  "Moorthy", "Sekar", "Selvam", "Mani", "Baskaran", "Krishnan", "Velan", "Rangan"
];

// Official AIROX'26 Technical Events
const techEventsList = [
  "The Final Hire",
  "The Final Hire, Zero Hour",
  "Zero Hour",
  "Paper Presentation",
  "The Prompt League",
  "Paper Presentation, Zero Hour",
  "The Final Hire, Paper Presentation",
  "The Prompt League, Zero Hour",
  "Paper Presentation, The Prompt League"
];

// Official AIROX'26 Non-Technical Events
const nonTechEventsList = [
  "AD SHOT",
  "GOATED OR GHOSTED",
  "CLASH AND CONQUER",
  "BOX CRICKET",
  "ESPORTS (FREE FIRE & STUMBLE GUYS)",
  "AD SHOT, GOATED OR GHOSTED",
  "CLASH AND CONQUER, BOX CRICKET",
  "BOX CRICKET, ESPORTS (FREE FIRE & STUMBLE GUYS)",
  "Ad Shot",
  "ad battle",
  "Goated  Or  Ghosted",
  "Clash & Conquer",
  "Box  Cricket",
  "Free Fire",
  "AD  SHOT",
  "None",
  ""
];

const modes = ["Individual", "Team"];
const teams = ["CyberKnights", "Algorand 404", "RoboSquad", "ByteBusters", "Binary Titans", "NeuralNets", "PixelCraft", "QuantumCoders", "CodeDynasty", "Apex Predators"];
const statuses = ["Verified", "Verified", "Verified", "Pending", "Verified", "Verified", "Rejected", "Pending", "Verified"];

// Build the full 321 dataset
for (let i = 21; i <= 321; i++) {
  const regId = `AIR${String(i).padStart(3, '0')}`;
  const fName = firstNames[(i * 7 + 3) % firstNames.length];
  const lName = lastNames[(i * 5 + 2) % lastNames.length];
  const fullName = `${fName} ${lName} ${String.fromCharCode(65 + (i % 26))}`;
  const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@${i % 3 === 0 ? 'gmail.com' : i % 3 === 1 ? 'yahoo.com' : 'outlook.com'}`;
  const mobile = `9${Math.floor(100000000 + ((i * 9876543) % 899999999))}`;
  const college = collegesList[i % collegesList.length];
  const mode = modes[i % 5 === 0 ? 1 : 0];
  const team = mode === "Team" ? teams[i % teams.length] : "";
  const status = statuses[i % statuses.length];

  let techEvent = techEventsList[i % techEventsList.length];
  let nonTechEvent = nonTechEventsList[i % nonTechEventsList.length];

  // Specific Edge Cases injected for testing:
  if (i === 45) {
    // "THE FINAL HIRE" (ALL CAPS)
    techEvent = "THE FINAL HIRE";
  } else if (i === 72) {
    // "the final hire" (all lowercase)
    techEvent = "the final hire, Zero Hour";
  } else if (i === 114) {
    // "The  Final   Hire" (extra internal whitespace)
    techEvent = "The  Final   Hire";
  } else if (i === 140) {
    // "AD BATTLE" (Non-tech legacy alias -> AD SHOT)
    nonTechEvent = "AD BATTLE";
  } else if (i === 188) {
    // "The FinalHire" (no space variation)
    techEvent = "The FinalHire";
  } else if (i === 220) {
    // "the finalhire" in lowercase
    techEvent = "the finalhire";
  } else if (i === 250) {
    // "ZeroHour" collapsed spacing
    techEvent = "ZeroHour, The Final Hire";
  } else if (i === 280) {
    // "Goated / Ghosted" non-tech alias
    nonTechEvent = "Goated / Ghosted";
  } else if (i === 300) {
    // "AD SHOT, GOATED OR GHOSTED" multi-event
    nonTechEvent = "AD SHOT, GOATED OR GHOSTED";
  }

  SAMPLE_AIROX26_RAW_DATA.push({
    "Registration ID": regId,
    "Full Name": fullName,
    "Email Address": email,
    "Mobile Number": mobile,
    "College / Institution": college,
    "Technical Events": techEvent,
    "Non-Technical Events": nonTechEvent === "None" ? "" : nonTechEvent,
    "How will you participate?": mode,
    "Team Name": team,
    "Verification Status": status
  });
}
