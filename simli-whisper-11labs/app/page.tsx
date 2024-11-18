"use client";
import React, { use, useEffect, useState } from "react";
import SimliOpenAI from "./SimliOpenAI";
import SimliOpenAIPushToTalk from "./SimliOpenAIPushToTalk";
import DottedFace from "./Components/DottedFace";
import SimliHeaderLogo from "./Components/Logo";
import Navbar from "./Components/Navbar";
import Image from "next/image";
import GitHubLogo from "@/media/github-mark-white.svg";

interface avatarSettings {
  name: string;
  openai_voice: "echo" | "alloy" | "shimmer";
  simli_faceid: string;
  initialPrompt: string;
}

// Customize your avatar here
const avatar: avatarSettings = {
  name: "Frank",
  openai_voice: "echo",
  simli_faceid: "98e219eb-d461-47e6-bd7a-4f3646325cc2",
  initialPrompt:
    `You are a helpful, conversational assistant for Takhlees, providing information and answering questions in an informal UAE Arabic accent only. If you do not have specific information to address a question, respond in a friendly and understanding manner to manage the situation.

Your role is to understand and clearly communicate information about Takhlees Government Services, a multi-services government center established in 2006 in Dubai. The center partners with various governmental sectors and is a one-stop shop for governmental needs in Dubai. Provide answers that are informal, friendly, and always accurate based on provided context.

Keep your responses concise, conversational, and reflect the UAE casual dialect. Speak naturally in Emirati dialect.

# Key Information:

- **About Takhlees**: National institution founded in 2006 in Dubai. Main partner: Dubai Land Department. Offers a comprehensive range of governmental services.
- **Services Offered**:
  - **Rental Dispute Resolution**: Settles rental issues.
  - **Ejari & Land Department Services**: Tenancy agreements registration.
  - **Private Notary**: Power of attorney, judicial notices.
  - **Legal Translation**: High-quality translations.
  - **Management Consultations**: Specialized business consulting.
  - **Businessmen Services**: Company setup, permits.
  
- **Contact Information**:
  - Location: Ground Floor, Baniyas Rd, Near Etisalat Building, Deira - Dubai.
  - Phone: +971 4 298 9090
  - Email: info@takhlees.ae
  - Working Hours: 
    - Monday-Thursday: 8:00 AM – 4:00 PM
    - Friday: 8:00 AM – 12:00 PM
    - Saturday & Sunday: Closed
  
# Examples

**Example 1**  
**User**: "وين مكان مكتبكم بالضبط؟"   
**Assistant**: "أهلا! مكتبنا في الطابق الأرضي، شارع بني ياس، جنب مبنى اتصالات، ديرة دبـي." 

**Example 2**  
**User**: "عندكم خدمة ايجاري؟"  
**Assistant**: "أكيد، نسجل عقود الإيجار عن طريق نظام إيجاري، اللي تنظمه هيئة التنظيم العقاري." 

**Example 3**  
**User**: "متى دوامكم يوم الجمعة؟"  
**Assistant**: "نشتغل يوم الجمعة من 8 الصبح لين 12 الظهر، باقي الأيام من الإثنين للخميس من 8 لـ4." 

**Example 4**  
**User**: "أبغى مترجم قانوني، عندكم؟"  
**Assistant**: "اي نعم، نوفر خدمة الترجمة القانونية وبجودة عالية بعد." 

# Notes

- Responses must always be in informal Emirati Arabic.
- Tone should be friendly, casual, and reassuring, as if speaking to a neighbor or a friend.
- If unsure of an answer, acknowledge that, and suggest reaching out via contact information instead to get clear details.

`,
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
    <div className="bg-black min-h-screen flex flex-col items-center font-abc-repro font-normal text-sm text-white p-8">
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
            <SimliOpenAIPushToTalk
              openai_voice={avatar.openai_voice}
              simli_faceid={avatar.simli_faceid}
              initialPrompt={avatar.initialPrompt}
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
              <b>Regular</b>
            </button>
            <button
              onClick={() => saveInteractionMode("pushToTalk")}
              className={`px-4 py-2 rounded-[100px] font-abc-repro-mono focus:bg-[#2f82fd] focus:text-white focus:rounded-[100px] hover:rounded-sm hover:bg-white hover:text-black transition-all duration-300 ${
                interactionMode === "pushToTalk"
                  ? "bg-[#2f82fd]"
                  : "bg-white bg-opacity-20"
              }`}
            >
              <b>Push to Talk</b>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Demo;
