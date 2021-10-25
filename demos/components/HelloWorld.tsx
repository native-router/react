type Props = {
  className?: string;
};

export default function HelloWorld({className}: Props) {
  return <div className={className}>Hello World!</div>;
}
