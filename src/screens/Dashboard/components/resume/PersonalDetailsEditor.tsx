import { useArtboardStore } from "../../../../store/artboard";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ResumePhotoEditor } from "./ResumePhotoEditor";

interface PersonalDetailsEditorProps {
  hasProfileAvatar: boolean;
  profileAvatarUrl: string | null;
  syncingProfilePhoto: boolean;
  onUseProfileImage: () => Promise<boolean>;
  onRefreshProfileImage: () => Promise<boolean>;
}

export const PersonalDetailsEditor = ({
  hasProfileAvatar,
  profileAvatarUrl,
  syncingProfilePhoto,
  onUseProfileImage,
  onRefreshProfileImage,
}: PersonalDetailsEditorProps) => {
  const basics = useArtboardStore((state) => state.resume.data.basics);
  const updateBasics = useArtboardStore((state) => state.updateBasics);

  const updateField = (field: keyof typeof basics, value: any) => {
    updateBasics({ [field]: value });
  };

  const handleAddProfile = () => {
    const newProfile = {
      network: "",
      username: "",
      url: "",
      icon: "",
    };
    updateBasics({
      profiles: [...(basics.profiles || []), newProfile],
    });
  };

  const updateProfile = (index: number, field: string, value: string) => {
    const newProfiles = [...(basics.profiles || [])];
    newProfiles[index] = { ...newProfiles[index], [field]: value };
    updateBasics({ profiles: newProfiles });
  };
  const removeProfile = (index: number) => {
    const newProfiles = [...(basics.profiles || [])];
    newProfiles.splice(index, 1);
    updateBasics({ profiles: newProfiles });
  };

  return (
    <div className='p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200'>
      <div className='flex flex-col gap-4'>
        <div>
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Full Name
          </label>
          <Input
            value={basics.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder='John Doe'
          />
        </div>
        <div >
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Job Title
          </label>
          <Input
            value={basics.headline}
            onChange={(e) => updateField("headline", e.target.value)}
            placeholder='Senior Software Engineer'
          />
        </div>
        <div>
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Email
          </label>
          <Input
            value={basics.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder='john@example.com'
          />
        </div>
        <div>
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Phone
          </label>
          <Input
            value={basics.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder='+1 (555) 123-4567'
          />
        </div>
        <div >
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Location
          </label>
          <Input
            value={basics.location}
            onChange={(e) => updateField("location", e.target.value)}
            placeholder='San Francisco, CA'
          />
        </div>
        <div>
          <label className='block text-xs font-medium product-helper-text mb-1.5'>
            Personal Website
          </label>
          <Input
            value={basics.website?.url || ""}
            onChange={(e) =>
              updateField("website", { ...basics.website, url: e.target.value })
            }
            placeholder='https://johndoe.dev'
          />
        </div>

        <ResumePhotoEditor
          hasProfileAvatar={hasProfileAvatar}
          profileAvatarUrl={profileAvatarUrl}
          syncingProfilePhoto={syncingProfilePhoto}
          onUseProfileImage={onUseProfileImage}
          onRefreshProfileImage={onRefreshProfileImage}
        />
      </div>

      <div className='border-t border-border/40 pt-4'>
        <label className='block text-xs font-medium product-helper-text mb-3'>
          Social Profiles
        </label>
        <div className='space-y-3'>
          {basics.profiles?.map((profile, index) => (
            <div
              key={index}
              className='group flex flex-col gap-2 sm:flex-row sm:items-start'
            >
              <div className='grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2'>
                <Input
                  value={profile.network}
                  onChange={(e) =>
                    updateProfile(index, "network", e.target.value)
                  }
                  placeholder='Network (e.g. LinkedIn)'
                  className='col-span-1'
                />
                <Input
                  value={profile.username}
                  onChange={(e) =>
                    updateProfile(index, "username", e.target.value)
                  }
                  placeholder='Username'
                  className='col-span-1'
                />
                <Input
                  value={profile.url}
                  onChange={(e) => updateProfile(index, "url", e.target.value)}
                  placeholder='URL'
                  className='sm:col-span-2'
                />
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => removeProfile(index)}
                className='product-helper-text self-end hover:bg-brand/10 hover:text-brand sm:self-start'
              >
                <Trash2 className='w-4 h-4' />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant='outline'
          className='product-outline-button mt-3 w-full border-dashed hover:border-brand hover:text-brand'
          onClick={handleAddProfile}
        >
          <Plus className='w-4 h-4 mr-2' />
          Add Profile
        </Button>
      </div>
    </div>
  );
};
