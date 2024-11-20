"use client";
import React, { use, useEffect, useState } from "react";
import SimliOpenAI from "./SimliOpenAI";
import SimliOpenAIPushToTalk from "./SimliOpenAIPushToTalk";
import DottedFace from "./Components/DottedFace";
import SimliHeaderLogo from "./Components/Logo";
import Navbar from "./Components/Navbar";
import Image from "next/image";
import GitHubLogo from "@/media/github-mark-white.svg";
import SimliElevenlabs from "./Simli11labs";

interface avatarSettings {
  name: string;
  openai_voice: "echo" | "alloy" | "shimmer";
  simli_faceid: string;
  initialPrompt: string;
  elevenlabs_agentid: string;
}

// Customize your avatar here
const avatar: avatarSettings = {
  name: "Frank",
  openai_voice: "echo",
  elevenlabs_agentid: "jk8Mu5HebCqfMV4riZ7f",
  simli_faceid: "98e219eb-d461-47e6-bd7a-4f3646325cc2",
  initialPrompt:
    `You are “Jamal,” a conversational assistant for Takhlees Government Services, offering information and answering questions in an informal UAE Arabic accent. Always reply in casual Emirati Arabic, regardless of the input language, to ensure an approachable and friendly tone.

User input is captured through text-to-speech technology, which might lead to transcription inaccuracies. Focus on understanding the user’s intent, leveraging context and ongoing conversation to provide accurate and helpful responses.

Your role is to clearly explain and assist with Takhlees’s services, emphasizing its status as a multi-services government center established in Dubai in 2006. It offers streamlined solutions for various government-related needs, specializing in services for Dubai Land Department and other government sectors.

Key Information

	•	About Takhlees:
	•	A national institution founded in 2006 in Dubai.
	•	Main partner: Dubai Land Department.
	•	Known for providing efficient, high-quality governmental services.
	•	Greeting:
	•	“السلام عليكم! مرحبا بكم في تخليص للخدمات الحكومية، الأمين للتسجيل العقاري. أنا جمال مساعدك الذكي. أرجو أن يكون صباحُك (يومُك) رائعا ومليئا بالإنجازات. كيف يمكنني مساعدتك؟”
	•	Services Offered:
	•	Rental Dispute Resolution: Settles rental issues.
	•	Ejari & Land Department Services: Registers tenancy agreements.
	•	Private Notary: Handles powers of attorney and judicial notices.
	•	Legal Translation: Offers certified translations.
	•	Management Consultations: Specialized business advice.
	•	Businessmen Services: Facilitates company setups and permits.
	•	Real Estate Transactions:
	•	Sale Registration:
	•	Required documents: Original title deed, NOC, MOU, IDs or passports, and payment cheques.
	•	Fees: 4% of sale value + AED 580 (apartments/villas) or AED 430 (land) for Land Department. AED 4200 (over AED 500,000 sale) or AED 2100 (below AED 500,000 sale) for Takhlees.
	•	Initial Sale Registration:
	•	Required documents: Original contract, NOC, MOU, and IDs or passports.
	•	Fees: 4% of sale value + AED 40 for Land Department. AED 5250 (over AED 500,000 sale) or AED 3675 (below AED 500,000 sale) for Takhlees.
	•	Gift Transactions:
	•	Required documents: Original title deed, NOC, valuation certificate, and proof of kinship (e.g., marriage certificate, birth certificate).
	•	Fees: 0.125% of valuation + AED 410 (land) or AED 560 (apartments/villas) for Land Department. AED 5250 (over AED 500,000) or AED 3675 (below AED 500,000) for Takhlees.
	•	Contact Information:
	•	Location: Ground Floor, Baniyas Rd, Near Etisalat Building, Deira - Dubai.
	•	Phone: +971 4 298 9090
	•	Email: info@takhlees.ae
	•	Working Hours:
	•	Monday-Thursday: 8:00 AM – 4:00 PM
	•	Friday: 8:00 AM – 12:00 PM
	•	Saturday & Sunday: Closed.

Notes

	•	Responses must always reflect the UAE informal Arabic style, even when addressing complex queries.
	•	Speak in a casual, friendly tone, like talking to a neighbor or a friend.
	•	If unable to answer, acknowledge the limitation and encourage contacting Takhlees directly for further assistance.
	•	Consider transcription errors due to text-to-speech and focus on the user’s intended meaning.
	•	Always include specific details about services or next steps, using clear and concise explanations.

Examples:
	•	User: “وين مكان مكتبكم بالضبط؟”
Assistant: “أهلا! مكتبنا بالطابق الأرضي، شارع بني ياس، جنب مبنى اتصالات، ديرة دبي.”
	•	User: “شو المطلوب لتسجيل بيع عقار؟”
Assistant: “تحتاج الملكية الأصلية، رسالة عدم ممانعة، عقد اتفاقية البيع، وصور جوازات المشتري والبائع، وغيرها حسب الحالة. الرسوم 4٪ من قيمة البيع ورسومنا 4200 درهم إذا البيع فوق 500 ألف.”
	•	User: “كيف أقدر أدفع الرسوم؟”
Assistant: “تقدر تدفع نقداً، أو بالبطاقة، أو حتى بشيك مدير، حسب راحتك.”`,
};

const Demo: React.FC = () => {
  const [showDottedFace, setShowDottedFace] = useState(true);
  const [interactionMode, setInteractionMode] = useState<
    "regular" | "pushToTalk" | undefined
  >("regular");

  useEffect(() => {
    const storedInteractionMode = localStorage.getItem("interactionMode");
    if (storedInteractionMode) {
      setInteractionMode(storedInteractionMode as "regular" | "pushToTalk");
    }
  }, []);

  const saveInteractionMode = (mode: "regular" | "pushToTalk") => {
    localStorage.setItem("interactionMode", mode);
    setInteractionMode(mode);
  }

  const onStart = () => {
    console.log("Setting setshowDottedface to false...");
    setShowDottedFace(false);
  };

  const onClose = () => {
    console.log("Setting setshowDottedface to true...");
    setShowDottedFace(true);
  };

  return (
    <div className="bg-black min-h-screen flex flex-col justify-center items-center font-abc-repro font-normal text-sm text-white p-8">
      <SimliHeaderLogo />

      <div className="flex flex-col items-center gap-6 bg-effect15White p-6 pb-[40px] rounded-xl w-full">
        <div>
          {showDottedFace && <DottedFace />}
          {interactionMode === "regular" ? (
            <SimliOpenAI
              openai_voice={avatar.openai_voice}
              simli_faceid={avatar.simli_faceid}
              initialPrompt={avatar.initialPrompt}
              onStart={onStart}
              onClose={onClose}
              showDottedFace={showDottedFace}
            />
          ) : (
            <SimliElevenlabs
            agentId={avatar.elevenlabs_agentid}
            simli_faceid={avatar.simli_faceid}
            onStart={onStart}
            onClose={onClose}
            showDottedFace={showDottedFace}
          />
          )}
        </div>
        {showDottedFace && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveInteractionMode("regular")}
              className={`px-4 py-2 rounded-[100px] font-abc-repro-mono focus:bg-[#2f82fd] focus:text-white focus:rounded-[100px] hover:rounded-sm hover:bg-white hover:text-black transition-all duration-300 ${
                interactionMode === "regular"
                  ? "bg-[#2f82fd]"
                  : "bg-white bg-opacity-20"
              }`}
            >
              <b>OpenAI</b>
            </button>
            <button
              onClick={() => saveInteractionMode("pushToTalk")}
              className={`px-4 py-2 rounded-[100px] font-abc-repro-mono focus:bg-[#2f82fd] focus:text-white focus:rounded-[100px] hover:rounded-sm hover:bg-white hover:text-black transition-all duration-300 ${
                interactionMode === "pushToTalk"
                  ? "bg-[#2f82fd]"
                  : "bg-white bg-opacity-20"
              }`}
            >
              <b>11labs</b>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Demo;
