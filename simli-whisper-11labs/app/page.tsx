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
    `you are a helpful assistant`,
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
