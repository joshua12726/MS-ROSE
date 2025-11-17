// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin
    if (!isAdmin()) {
        window.location.href = 'admin-login.html';
        return;
    }

    loadAdminDashboard();
    setupAdminEventListeners();
    setupExportProductsListener();
    loadRiderManagement(); // Load rider management on page load
});

function setupExportProductsListener() {
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportProductsToJSON);
    }
}

// Export products to JSON file
function exportProductsToJSON() {
    if (!window.fetchProductsFromFirebase) {
        showModal('alert', 'Product export function is not available.');
        return;
    }

    exportBtnDisabled(true);

    window.fetchProductsFromFirebase().then(products => {
        const jsonStr = JSON.stringify(products, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'products-export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
        showModal('alert', 'Products exported successfully!');
    }).catch(error => {
        console.error('Error exporting products:', error);
        showModal('alert', 'Failed to export products. Please try again.');
    }).finally(() => {
        exportBtnDisabled(false);
    });
}

function exportBtnDisabled(disabled) {
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
        exportBtn.disabled = disabled;
        exportBtn.textContent = disabled ? 'Exporting...' : 'Export Products to JSON';
    }
}

// Check if user is admin
function isAdmin() {
    const adminUser = localStorage.getItem('adminUser');
    return adminUser !== null;
}

// Load admin dashboard
function loadAdminDashboard() {
    loadOrders();
    updateStats();
}

// Setup event listeners
function setupAdminEventListeners() {
    // Add any additional event listeners here if needed
}

// Load orders from localStorage
function loadOrders(filter = 'all') {
    const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');
    const ordersContainer = document.getElementById('orders-container');

    if (orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="empty-orders">
                <h3>No Orders Yet</h3>
                <p>Orders will appear here once customers place them.</p>
            </div>
        `;
        return;
    }

    // Filter orders based on status
    let filteredOrders = orders;
    if (filter !== 'all') {
        filteredOrders = orders.filter(order => order.status === filter);
    }

    // For 'confirmed' filter, also include 'pending' orders since they can be accepted
    if (filter === 'confirmed') {
        const pendingOrders = orders.filter(order => order.status === 'pending');
        filteredOrders = [...filteredOrders, ...pendingOrders];
    }

    // Sort orders by timestamp (newest first)
    filteredOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let ordersHTML = '<div class="orders-grid">';

    filteredOrders.forEach(order => {
        ordersHTML += generateAdminOrderCardHTML(order);
    });

    ordersHTML += '</div>';
    ordersContainer.innerHTML = ordersHTML;
}

// Generate HTML for admin order card
function generateAdminOrderCardHTML(order) {
    const orderDate = new Date(order.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const paymentMethodNames = {
        'gcash': 'GCash',
        'card': 'Credit/Debit Card',
        'cod': 'Cash on Delivery'
    };

    // Get current status or default to confirmed
    const currentStatus = order.status || 'confirmed';
    const statusClass = `status-${currentStatus}`;

    // Status display text mapping
    const statusDisplayText = {
        'pending': 'Pending',
        'confirmed': 'Accepted order',
        'preparing': 'Preparing',
        'assigned': 'Assigned to Rider',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };

    const statusText = statusDisplayText[currentStatus] || currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);

    let itemsHTML = '';
    order.items.forEach(item => {
        const mediaHTML = item.image
            ? `<div class="item-thumb"><img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'"></div>`
            : `<div class="item-emoji">${item.emoji || '🍽️'}</div>`;

        itemsHTML += `
            <div class="order-item">
                <div class="item-info">
                    ${mediaHTML}
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p>Qty: ${item.quantity} × ₱${item.price.toFixed(2)}</p>
                    </div>
                </div>
                <div class="item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        `;

        // Add discount information if applicable
        if (order.discountType && order.discountType !== 'none' && order.discount > 0) {
            const discountName = getDiscountDisplayName(order.discountType);
            itemsHTML += `
                <div class="order-item">
                    <div class="item-info">
                        <div class="item-details">
                            <h4 style="color: #ff6b35;">${discountName}</h4>
                            <p>Applied to order</p>
                        </div>
                    </div>
                    <div class="item-price" style="color: #ff6b35;">-₱${order.discount.toFixed(2)}</div>
                </div>
            `;
        }
    });

    // Generate action buttons based on current status
    let actionButtons = '';

    if (currentStatus === 'pending') {
        actionButtons = `
            <button class="admin-btn btn-accept" onclick="updateOrderStatus('${order.orderNumber}', 'confirmed')">Accept Order</button>
            <button class="admin-btn btn-cancel" onclick="updateOrderStatus('${order.orderNumber}', 'cancelled')">Cancel Order</button>
        `;
    } else if (currentStatus === 'confirmed') {
        actionButtons = `
            <button class="admin-btn btn-confirm" onclick="updateOrderStatus('${order.orderNumber}', 'preparing')">Start Preparing</button>
            <button class="admin-btn btn-cancel" onclick="updateOrderStatus('${order.orderNumber}', 'cancelled')">Cancel Order</button>
        `;
    } else if (currentStatus === 'preparing') {
        actionButtons = `
            <button class="admin-btn btn-assign" onclick="assignRider('${order.orderNumber}')">Assign Rider</button>
            <button class="admin-btn btn-cancel" onclick="updateOrderStatus('${order.orderNumber}', 'cancelled')">Cancel Order</button>
        `;
    } else if (currentStatus === 'assigned') {
        actionButtons = `
            <button class="admin-btn btn-deliver" onclick="updateOrderStatus('${order.orderNumber}', 'delivered')">Mark Delivered</button>
            <button class="admin-btn btn-cancel" onclick="updateOrderStatus('${order.orderNumber}', 'cancelled')">Cancel Order</button>
        `;
    } else if (currentStatus === 'delivered') {
        actionButtons = '<span style="color: #10b981; font-weight: 500;">Order Completed</span>';
    } else if (currentStatus === 'cancelled') {
        actionButtons = '<span style="color: #ef4444; font-weight: 500;">Order Cancelled</span>';
    }

    return `
        <div class="order-card" data-order-id="${order.orderNumber}">
            <div class="order-header">
                <div class="order-info">
                    <h3>Order #${order.orderNumber}</h3>
                    <p>${orderDate} • ${paymentMethodNames[order.paymentMethod]}</p>
                </div>
                <div class="order-status ${statusClass}">
                    ${statusText}
                </div>
            </div>

            <div class="order-items">
                ${itemsHTML}
            </div>

            <div class="order-footer">
                <div class="order-total">
                    Total: ₱${order.total.toFixed(2)}
                </div>
                <div class="admin-actions">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

// Update order status
function updateOrderStatus(orderNumber, newStatus) {
    const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');
    const orderIndex = orders.findIndex(order => order.orderNumber === orderNumber);

    if (orderIndex === -1) {
        showNotification('Order not found', 'error');
        return;
    }

    // Update order status
    orders[orderIndex].status = newStatus;
    orders[orderIndex].statusUpdatedAt = new Date().toISOString();

    // Save updated orders
    localStorage.setItem('quickOrderOrders', JSON.stringify(orders));

    // Reload orders display
    const activeFilter = document.querySelector('.filter-btn.active');
    let filterType = 'all';
    if (activeFilter) {
        const text = activeFilter.textContent;
        if (text === 'Accept') {
            filterType = 'confirmed';
        } else if (text === 'Assign Rider') {
            filterType = 'assigned';
        } else {
            filterType = text.toLowerCase().replace(' ', '-');
        }
    }
    loadOrders(filterType);

    // Update statistics
    updateStats();

    // Show success notification
    const statusMessages = {
        'confirmed': 'Order has been accepted',
        'preparing': 'Order is now being prepared',
        'assigned': 'Rider has been assigned',
        'delivered': 'Order marked as delivered',
        'cancelled': 'Order has been cancelled'
    };

    showNotification(statusMessages[newStatus] || 'Order status updated', 'success');

    // If order was accepted, show notification to user (in a real app, this would be sent via email/push notification)
    if (newStatus === 'confirmed') {
        // In a real implementation, you would send a notification to the customer
        console.log(`Order ${orderNumber} has been accepted by admin`);
    }


}

// Filter orders by status
function filterOrders(status) {
    // Update active filter button
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));

    // Find and activate the clicked button
    let clickedButton;
    if (status === 'all') {
        clickedButton = Array.from(filterButtons).find(btn => btn.textContent === 'All Orders');
    } else if (status === 'confirmed') {
        clickedButton = Array.from(filterButtons).find(btn => btn.textContent === 'Accept');
    } else if (status === 'assigned') {
        clickedButton = Array.from(filterButtons).find(btn => btn.textContent === 'Assign Rider');
    } else if (status === 'delivered') {
        clickedButton = Array.from(filterButtons).find(btn => btn.textContent === 'Delivered');
    } else {
        clickedButton = Array.from(filterButtons).find(btn =>
            btn.textContent.toLowerCase() === status
        );
    }

    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // Load orders with filter
    loadOrders(status);
}

// Update dashboard statistics
function updateStats() {
    const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');

    // Calculate statistics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(order =>
        (order.status === 'confirmed' || order.status === 'preparing') ||
        (!order.status && order.status !== 'cancelled')
    ).length;

    const totalRevenue = orders
        .filter(order => order.status !== 'cancelled')
        .reduce((sum, order) => sum + order.total, 0);

    // Update UI
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('pending-orders').textContent = pendingOrders;
    document.getElementById('total-revenue').textContent = `₱${totalRevenue.toFixed(2)}`;
}

// Admin logout
function adminLogout() {
    showModal('confirm', 'Are you sure you want to logout?', () => {
        localStorage.removeItem('adminUser');
        window.location.href = 'admin-login.html';
    });
}

// Close order modal
function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
}

// Notification system
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '90px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10001',
        transform: 'translateX(400px)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    });

    const colors = {
        success: '#10b981',
        info: '#3b82f6',
        warning: '#f59e0b',
        error: '#ef4444'
    };

    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Get discount display name
function getDiscountDisplayName(discountType) {
    switch(discountType) {
        case 'student':
            return 'Student Discount (20%)';
        case 'senior':
            return 'Senior Citizen Discount (30%)';
        case 'pwd':
            return 'PWD Discount (40%)';
        default:
            return '';
    }
}

// Assign rider function
function assignRider(orderNumber) {
    // Get all rider accounts from localStorage
    const riderKeys = Object.keys(localStorage).filter(key => key.startsWith('riderAccount_'));
    const riders = riderKeys.map(key => {
        const riderData = JSON.parse(localStorage.getItem(key));
        return {
            email: riderData.email,
            name: riderData.name || riderData.email.split('@')[0]
        };
    });

    if (riders.length === 0) {
        showNotification('No riders available. Please register riders first.', 'warning');
        return;
    }

    // Create modal for rider selection
    const modal = document.createElement('div');
    modal.className = 'rider-modal';
    modal.innerHTML = `
        <div class="rider-modal-content">
            <h3>Assign Rider to Order #${orderNumber}</h3>
            <div class="rider-list">
                ${riders.map(rider => `
                    <div class="rider-option" onclick="selectRider('${orderNumber}', '${rider.email}')">
                        <div class="rider-info">
                            <strong>${rider.name}</strong>
                            <span>${rider.email}</span>
                        </div>
                        <button class="select-rider-btn">Select</button>
                    </div>
                `).join('')}
            </div>
            <button class="cancel-btn" onclick="closeRiderModal()">Cancel</button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// Select rider and update order
function selectRider(orderNumber, riderEmail) {
    const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');
    const orderIndex = orders.findIndex(order => order.orderNumber === orderNumber);

    if (orderIndex === -1) {
        showNotification('Order not found', 'error');
        return;
    }

    // Update order status and assign rider
    orders[orderIndex].status = 'assigned';
    orders[orderIndex].assignedRider = riderEmail;
    orders[orderIndex].statusUpdatedAt = new Date().toISOString();

    // Save updated orders
    localStorage.setItem('quickOrderOrders', JSON.stringify(orders));

    // Trigger notification for customer order history
    const customerNotificationData = {
        type: 'order_assigned',
        orderNumber: orderNumber,
        timestamp: new Date().toISOString(),
        message: `Your order #${orderNumber} has been assigned to a rider and is on its way!`
    };

    // Store notification in localStorage for customer order history to pick up
    const existingCustomerNotifications = JSON.parse(localStorage.getItem('customerNotifications') || '[]');
    existingCustomerNotifications.push(customerNotificationData);
    localStorage.setItem('customerNotifications', JSON.stringify(existingCustomerNotifications));

    // Dispatch custom event for real-time notification (if orders page is open)
    window.dispatchEvent(new CustomEvent('customerNotification', {
        detail: customerNotificationData
    }));

    // Dispatch event for rider notification (only to the assigned rider)
    window.dispatchEvent(new CustomEvent('riderNotification', {
        detail: {
            riderEmail: riderEmail,
            orderNumber: orderNumber,
            type: 'order_assigned',
            timestamp: new Date().toISOString(),
            message: `New delivery assigned: Order #${orderNumber}`
        }
    }));

    // Close modal
    closeRiderModal();

    // Reload orders display
    const activeFilter = document.querySelector('.filter-btn.active');
    let filterType = 'all';
    if (activeFilter) {
        const text = activeFilter.textContent;
        if (text === 'Accept') {
            filterType = 'confirmed';
        } else if (text === 'Assign Rider') {
            filterType = 'assigned';
        } else {
            filterType = text.toLowerCase().replace(' ', '-');
        }
    }
    loadOrders(filterType);

    // Update statistics
    updateStats();

    // Show success notification
    showNotification('Rider has been assigned to the order', 'success');
}

// Close rider modal
function closeRiderModal() {
    const modal = document.querySelector('.rider-modal');
    if (modal) {
        modal.remove();
    }
}

// Generic modal function for alerts and confirms
function showModal(type, message, onConfirm = null, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'rider-modal'; // Reuse existing modal class for styling
    modal.innerHTML = `
        <div class="rider-modal-content">
            <h3>${type === 'alert' ? 'Alert' : 'Confirm Action'}</h3>
            <p>${message}</p>
            <div class="modal-buttons">
                ${type === 'alert'
                    ? `<button class="admin-btn btn-confirm" onclick="closeModalAndCallback(this, ${onConfirm ? `'confirm'` : 'null'})">OK</button>`
                    : `<button class="admin-btn btn-confirm" onclick="closeModalAndCallback(this, ${onConfirm ? `'confirm'` : 'null'})">Confirm</button>
                       <button class="admin-btn btn-cancel" onclick="closeModalAndCallback(this, ${onCancel ? `'cancel'` : 'null'})">Cancel</button>`
                }
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Store callbacks in the modal element
    modal.onConfirm = onConfirm;
    modal.onCancel = onCancel;
}

// Function to close modal and execute callback
function closeModalAndCallback(button, action) {
    const modal = button.closest('.rider-modal');
    if (modal) {
        modal.remove();
        if (action === 'confirm' && modal.onConfirm) {
            modal.onConfirm();
        } else if (action === 'cancel' && modal.onCancel) {
            modal.onCancel();
        }
    }
}

// Rider Management Functions
function loadRiderManagement() {
    const container = document.getElementById('rider-management-container');

    // Get all rider accounts from localStorage
    const riderKeys = Object.keys(localStorage).filter(key => key.startsWith('riderAccount_'));
    const riders = riderKeys.map(key => {
        const riderData = JSON.parse(localStorage.getItem(key));
        return {
            email: riderData.email,
            name: riderData.name || riderData.email.split('@')[0],
            phone: riderData.phone || 'N/A',
            createdAt: riderData.createdAt ? new Date(riderData.createdAt).toLocaleDateString() : 'N/A'
        };
    });

    if (riders.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>No Riders Registered</h3>
                <p>Riders will appear here once they create accounts in the delivery app.</p>
            </div>
        `;
        return;
    }

    let ridersHTML = '<div class="orders-grid">';

    riders.forEach(rider => {
        ridersHTML += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-info">
                        <h3>${rider.name}</h3>
                        <p>${rider.email} • ${rider.phone}</p>
                    </div>
                    <div class="order-status" style="background: #dbeafe; color: #1e40af;">
                        Active Rider
                    </div>
                </div>
                <div class="order-footer">
                    <div class="order-total">
                        Joined: ${rider.createdAt}
                    </div>
                    <div class="admin-actions">
                        <button class="admin-btn btn-confirm" onclick="viewRiderOrders('${rider.email}')">View Orders</button>
                        <button class="admin-btn btn-cancel" onclick="removeRider('${rider.email}')">Remove Rider</button>
                    </div>
                </div>
            </div>
        `;
    });

    ridersHTML += '</div>';
    container.innerHTML = ridersHTML;
}

function viewRiderOrders(riderEmail) {
    const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');
    const riderOrders = orders.filter(order => order.assignedRider === riderEmail);

    if (riderOrders.length === 0) {
        showNotification('No orders assigned to this rider yet', 'info');
        return;
    }

    // Create modal to show rider's orders
    const modal = document.createElement('div');
    modal.className = 'rider-modal';
    modal.innerHTML = `
        <div class="rider-modal-content" style="max-width: 800px;">
            <h3>Orders Assigned to ${riderEmail}</h3>
            <div class="rider-orders-list" style="max-height: 400px; overflow-y: auto;">
                ${riderOrders.map(order => `
                    <div class="order-card" style="margin-bottom: 10px;">
                        <div class="order-header">
                            <div class="order-info">
                                <h4>Order #${order.orderNumber}</h4>
                                <p>${new Date(order.timestamp).toLocaleDateString()} • ₱${order.total.toFixed(2)}</p>
                            </div>
                            <div class="order-status status-${order.status || 'confirmed'}">
                                ${order.status || 'confirmed'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="cancel-btn" onclick="closeRiderModal()">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function removeRider(riderEmail) {
    showModal('confirm', `Are you sure you want to remove rider ${riderEmail}? This action cannot be undone.`, () => {
        // Check if rider has active orders
        const orders = JSON.parse(localStorage.getItem('quickOrderOrders') || '[]');
        const activeOrders = orders.filter(order =>
            order.assignedRider === riderEmail &&
            (order.status === 'assigned' || order.status === 'picked' || order.status === 'onway')
        );

        if (activeOrders.length > 0) {
            showModal('alert', 'Cannot remove rider with active orders. Please reassign or complete orders first.');
            return;
        }

        // Remove rider account
        localStorage.removeItem('riderAccount_' + riderEmail);
        showModal('alert', 'Rider removed successfully');
        loadRiderManagement();
    });
}

// Load admin notifications
function loadAdminNotifications() {
    const container = document.getElementById('notifications-container');
    const notifications = JSON.parse(localStorage.getItem('adminNotifications') || '[]');

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>No Notifications Yet</h3>
                <p>Notifications for delivered orders will appear here.</p>
            </div>
        `;
        return;
    }

    // Sort notifications by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let notificationsHTML = '<div class="orders-grid">';

    notifications.forEach(notification => {
        const notificationDate = new Date(notification.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        notificationsHTML += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-info">
                        <h3>${notification.message}</h3>
                        <p>${notificationDate}</p>
                    </div>
                    <div class="order-status" style="background: #dbeafe; color: #1e40af;">
                        ${notification.type.replace('_', ' ').toUpperCase()}
                    </div>
                </div>
            </div>
        `;
    });

    notificationsHTML += '</div>';
    container.innerHTML = notificationsHTML;
}

// Make functions globally available
window.filterOrders = filterOrders;
window.updateOrderStatus = updateOrderStatus;
window.assignRider = assignRider;
window.selectRider = selectRider;
window.closeRiderModal = closeRiderModal;
window.adminLogout = adminLogout;
window.closeOrderModal = closeOrderModal;
window.exportProductsToJSON = exportProductsToJSON;
window.loadRiderManagement = loadRiderManagement;
window.viewRiderOrders = viewRiderOrders;
window.removeRider = removeRider;
    