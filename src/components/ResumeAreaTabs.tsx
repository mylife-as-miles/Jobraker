import { NavLink } from "react-router-dom";

// Switches between the Resumes list and the Application profile.
export function ResumeAreaTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    isActive ? "product-control-button-active px-4 py-1.5 text-sm" : "product-control-button px-4 py-1.5 text-sm";
  return (
    <nav aria-label='Resume area' className='product-control-surface inline-flex w-fit gap-1'>
      <NavLink to='/dashboard/resume' end className={tab}>
        Resumes
      </NavLink>
      <NavLink to='/dashboard/resume/profile' className={tab}>
        Application profile
      </NavLink>
    </nav>
  );
}
