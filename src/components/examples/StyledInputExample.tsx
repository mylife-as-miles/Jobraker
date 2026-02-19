import React, { useState } from 'react';
import { InputGroup } from '../ui/InputGroup';
import { StyledInput } from '../ui/StyledInput';

export const StyledInputExample: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Example with InputGroup component
  const signupFields = [
    {
      id: 'email',
      label: 'Email Address',
      placeholder: 'Enter your email',
      type: 'email',
      value: formData.email,
      onChange: (value: string) => handleFieldChange('email', value),
      error: errors.email,
      required: true
    },
    {
      id: 'password',
      label: 'Password',
      placeholder: 'Enter your password',
      type: 'password',
      value: formData.password,
      onChange: (value: string) => handleFieldChange('password', value),
      error: errors.password,
      required: true
    },
    {
      id: 'confirmPassword',
      label: 'Confirm Password',
      placeholder: 'Confirm your password',
      type: 'password',
      value: formData.confirmPassword,
      onChange: (value: string) => handleFieldChange('confirmPassword', value),
      error: errors.confirmPassword,
      required: true
    }
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Example 1: Default variant (light theme) */}
        <div className="bg-white p-6 rounded-lg">
          <h2 className="text-xl font-bold text-[#212121] mb-6">Default Input Style</h2>
          <InputGroup 
            fields={signupFields} 
            variant="default" 
            spacing="normal"
          />
          <button 
            onClick={validateForm}
            className="w-full mt-6 bg-[#1dff00] text-black py-3 px-4 rounded-lg font-medium hover:bg-[#1dff00]/90 transition-colors"
          >
            Validate Form
          </button>
        </div>

        {/* Example 2: Transparent variant (dark theme) */}
        <div className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-6">Transparent Input Style</h2>
          <InputGroup 
            fields={signupFields} 
            variant="transparent" 
            spacing="normal"
          />
          <button 
            onClick={validateForm}
            className="w-full mt-6 bg-[#1dff00] text-black py-3 px-4 rounded-lg font-medium hover:bg-[#1dff00]/90 transition-colors"
          >
            Validate Form
          </button>
        </div>

        {/* Example 3: Individual styled inputs */}
        <div className="bg-white p-6 rounded-lg">
          <h2 className="text-xl font-bold text-[#212121] mb-6">Individual Inputs</h2>
          <div className="space-y-6">
            <StyledInput
              label="First Name"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              variant="default"
            />
            <StyledInput
              label="Last Name"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              variant="default"
            />
            <StyledInput
              label="Phone Number"
              placeholder="Enter your phone number"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              variant="outlined"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyledInputExample;