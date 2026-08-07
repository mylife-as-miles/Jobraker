const joinTranscriptParts = (...parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

export const commitVoiceInterimTranscript = (
  finalizedTranscript: string,
  interimTranscript: string,
) => joinTranscriptParts(finalizedTranscript, interimTranscript);

export const mergeVoiceTranscript = ({
  baseText,
  finalizedTranscript,
  newFinalTranscript,
  interimTranscript,
}: {
  baseText: string;
  finalizedTranscript: string;
  newFinalTranscript: string;
  interimTranscript: string;
}) => {
  const nextFinalizedTranscript = joinTranscriptParts(
    finalizedTranscript,
    newFinalTranscript,
  );

  return {
    finalizedTranscript: nextFinalizedTranscript,
    draft: joinTranscriptParts(
      baseText,
      nextFinalizedTranscript,
      interimTranscript,
    ),
  };
};
