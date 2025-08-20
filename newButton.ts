import React from 'react';

type NewButtonProps = {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export const NewButton: React.FC<NewButtonProps> = ({
  label = 'Click Me Now',
  onClick,
  disabled = false,
}) => {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', borderRadius: 4 }}>
      {label}
    </button>
  );
};
