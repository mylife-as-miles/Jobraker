import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  DotsThreeVertical,
  Minus,
  Plus,
  DownloadSimple,
} from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui";

// This component renders the UI for the cover letter page.
// It includes a header, the cover letter content, and a footer with controls.
export const CoverLetter = () => {
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState(16);

  const zoomIn = () => setFontSize((size) => size + 1);
  const zoomOut = () => setFontSize((size) => size - 1);
  const download = () => alert("Downloading...");
  const editDetails = () => alert("Editing details...");
  const aiEdit = () => alert("AI edit...");

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </Button>
        <h1 className="text-xl font-bold">Software Engineer</h1>
        <Button variant="ghost" size="icon">
          <DotsThreeVertical size={24} />
        </Button>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div
          className="bg-white p-6 rounded-lg shadow-md"
          style={{ fontSize: `${fontSize}px` }}
        >
          <div className="mb-6">
            <p className="font-bold">[Your Name]</p>
            <p>[Your Phone Number]</p>
            <p>[Your Email]</p>
          </div>
          <div className="mb-6">
            <p>Dear Hiring Manager,</p>
          </div>
          <div className="space-y-4">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse
              lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor. Cras elementum
              ultrices diam. Maecenas ligula massa, varius a, semper congue, euismod non, mi.
            </p>
            <p>
              Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam
              nisl sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae, consequat in,
              pretium a, enim. Pellentesque congue. Ut in risus volutpat libero pharetra tempor.
            </p>
            <p>
              Cras vestibulum bibendum augue. Praesent egestas leo in pede. Praesent blandit odio eu
              enim. Pellentesque sed dui ut augue blandit sodales. Vestibulum ante ipsum primis in
              faucibus orci luctus et ultrices posuere cubilia Curae; Aliquam nibh.
            </p>
            <p>
              Mauris ac mauris sed pede pellentesque fermentum. Maecenas adipiscing ante non diam.
              Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam
              nisl sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae, consequat in,
              pretium a, enim.
            </p>
            <p>Best regards,</p>
            <p>[Your Name]</p>
          </div>
        </div>
      </main>

      <footer className="p-4 border-t">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={zoomOut}>
              <Minus size={20} />
            </Button>
            <Button variant="outline" size="icon" onClick={zoomIn}>
              <Plus size={20} />
            </Button>
          </div>
          <Button className="rounded-full h-12 w-12" onClick={download}>
            <DownloadSimple size={24} />
          </Button>
        </div>
        <div className="mt-4 flex justify-around">
          <Button variant="ghost" onClick={editDetails}>
            Edit Details
          </Button>
          <Button variant="ghost" onClick={aiEdit}>
            AI Edit
          </Button>
        </div>
      </footer>
    </div>
  );
};
