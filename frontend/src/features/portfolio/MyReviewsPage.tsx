import { T } from "@/shared/text";

import { MyReviews } from "./MyReviews";

/** Oddiy foydalanuvchi: o'zi qo'ygan baholar (`/baholarim`). */
export default function MyReviewsPage() {
  return (
    <div className="stack">
      <div className="uhead">
        <div className="uhead-text">
          <h1 className="uhead-title">{T.user.myReviews}</h1>
        </div>
      </div>
      <MyReviews />
    </div>
  );
}
