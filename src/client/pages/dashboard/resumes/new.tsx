import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { Helmet } from "react-helmet-async";

export default function NewResumeRedirect() {
  const navigate = useNavigate();
  const { createResume } = useCreateResume();

  useEffect(() => {
    const go = async () => {
      const title = generateRandomName();
      const slug = slugify(title);
  const res = await createResume({ title, slug, visibility: "private" });
  navigate(`/builder/${res.id}`, { replace: true, state: { resume: res } });
    };

    void go();
  }, [createResume, navigate]);

  return (
    <>
      <Helmet>
        <title>New Resume - JobRaker</title>
      </Helmet>
    </>
  );
}
