import React from "react";
import type { ReactNode } from "react";

import type { RichInfoMessage } from "@src/lib/text";

export const renderRichInfoMessage = ({
  leading,
  citation,
  postCitation,
  citeButtonLabel,
  postCiteButton,
}: RichInfoMessage): ReactNode => (
  <>
    {leading}
    <em>{citation}</em>
    {postCitation}
    <strong>{citeButtonLabel}</strong>
    {postCiteButton}
  </>
);

export default renderRichInfoMessage;
