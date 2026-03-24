import React from "react";
import Notification from "./Notification";

const NotificationContainer = ({ notifications, removeNotification }) => {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <Notification
            {...notification}
            onClose={() => removeNotification(notification.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
