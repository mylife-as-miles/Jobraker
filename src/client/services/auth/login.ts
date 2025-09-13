import type { AuthResponseDto, LoginDto } from "@reactive-resume/dto";
import { useMutation } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import { useNavigate } from "react-router-dom";

import { axios } from "@/client/libs/axios";
import { queryClient } from "@/client/libs/query-client";
import { useAuthStore } from "@/client/stores/auth";

export const login = async (data: LoginDto) => {
  const response = await axios.post<AuthResponseDto, AxiosResponse<AuthResponseDto>, LoginDto>(
    "/auth/login",
    data,
  );

  return response.data;
};

export const useLogin = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const {
    error,
    isPending: loading,
    mutateAsync: loginFn,
  } = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (data.status === "2fa_required") {
        // route removed; send to dashboard or a 2FA placeholder if added later
        void navigate("/dashboard");
        return;
      }

      setUser(data.user);
      queryClient.setQueryData(["user"], data.user);
    },
  });

  return { login: loginFn, loading, error };
};
