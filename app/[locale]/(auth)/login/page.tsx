import {LoginForm} from '@/components/auth/LoginForm';

interface Props {
  searchParams: {verified?: string};
}

export default function LoginPage({searchParams}: Props) {
  return <LoginForm verified={searchParams.verified === '1'} />;
}
