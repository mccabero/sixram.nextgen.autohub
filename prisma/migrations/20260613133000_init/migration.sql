-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CameraEvents" (
    "Id" SERIAL NOT NULL,
    "CameraIp" VARCHAR(64),
    "Ipv6Address" VARCHAR(80),
    "PortNo" INTEGER,
    "Protocol" VARCHAR(20),
    "MacAddress" VARCHAR(32),
    "ChannelId" INTEGER,
    "ChannelName" VARCHAR(100),
    "EventDateTime" TIMESTAMPTZ(3) NOT NULL,
    "EventType" VARCHAR(80) NOT NULL,
    "EventState" VARCHAR(30) NOT NULL,
    "EventDescription" VARCHAR(200),
    "ActivePostCount" INTEGER,
    "Source" VARCHAR(80),
    "SnapshotPath" VARCHAR(300),
    "SnapshotUrl" VARCHAR(300),
    "SnapshotCapturedDateTime" TIMESTAMP(3),
    "SnapshotError" VARCHAR(500),
    "RawXml" TEXT NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraEvents_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CompanyInfos" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Address" TEXT NOT NULL,
    "Email" VARCHAR(100) NOT NULL,
    "MobileNumber" VARCHAR(50) NOT NULL,
    "TIN" VARCHAR(50) NOT NULL,
    "GCash" VARCHAR(50) NOT NULL,
    "BankNo" VARCHAR(100) NOT NULL,
    "Name1" VARCHAR(100) NOT NULL,
    "Address1" TEXT NOT NULL,
    "Email1" VARCHAR(100) NOT NULL,
    "MobileNumber1" VARCHAR(50) NOT NULL,
    "TIN1" VARCHAR(50) NOT NULL,
    "GCash1" VARCHAR(50) NOT NULL,
    "BankNo1" VARCHAR(100) NOT NULL,
    "IsPrimaryCompany" BOOLEAN NOT NULL DEFAULT false,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInfos_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Customers" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "FirstName" VARCHAR(100) NOT NULL,
    "MiddleName" VARCHAR(100),
    "LastName" VARCHAR(100) NOT NULL,
    "Gender" INTEGER NOT NULL,
    "Birthday" TIMESTAMP(3),
    "CustomerCode" VARCHAR(50),
    "MobileNumber" VARCHAR(50) NOT NULL,
    "Email" VARCHAR(100),
    "HomeAddress" TEXT,
    "Notes" TEXT,
    "CompanyName" TEXT,
    "CompanyAddress" TEXT,
    "CompanyNo" VARCHAR(50),
    "IsActive" BOOLEAN NOT NULL,
    "LaborDiscountRate" DECIMAL(18,2) NOT NULL,
    "ProductDiscountRate" DECIMAL(18,2) NOT NULL,
    "IsVATExempt" BOOLEAN NOT NULL,
    "IsAllowWithholidingTax" BOOLEAN NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customers_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Deposits" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsRefund" BOOLEAN NOT NULL,
    "ReferenceNo" VARCHAR(100) NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "TransactionDateTime" TIMESTAMP(3) NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "JobOrderId" INTEGER NOT NULL,
    "PaymentTypeParameterId" INTEGER NOT NULL,
    "DepositAmount" DECIMAL(18,2) NOT NULL,
    "PaymentReferenceNo" VARCHAR(100),
    "Description" TEXT,
    "RefundAmount" DECIMAL(18,2),
    "RefundDateTime" TIMESTAMP(3),
    "RefundReason" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposits_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Estimates" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsPackage" BOOLEAN NOT NULL,
    "IsCustomerApproved" BOOLEAN NOT NULL,
    "InspectionId" INTEGER,
    "ReferenceNo" VARCHAR(255) NOT NULL,
    "TransactionDate" TIMESTAMP(3),
    "ExpirationDate" TIMESTAMP(3),
    "EstimatedDays" INTEGER NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "VehicleId" INTEGER NOT NULL,
    "AdvisorUserId" INTEGER NOT NULL,
    "EstimatorUserId" INTEGER NOT NULL,
    "ApproverUserId" INTEGER NOT NULL,
    "ServiceGroupId" INTEGER NOT NULL,
    "Odometer" INTEGER,
    "NextOdometerReminder" INTEGER,
    "CustomerPO" VARCHAR(100),
    "Summary" VARCHAR(255),
    "SubTotal" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "LaborDiscount" DECIMAL(18,2) NOT NULL,
    "ProductDiscount" DECIMAL(18,2) NOT NULL,
    "AdditionalDiscount" DECIMAL(18,2) NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimates_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EstimatePackages" (
    "Id" SERIAL NOT NULL,
    "EstimateId" INTEGER NOT NULL,
    "PackageId" INTEGER NOT NULL,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimatePackages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EstimateProducts" (
    "Id" SERIAL NOT NULL,
    "IsPackage" BOOLEAN NOT NULL,
    "IsRequired" BOOLEAN NOT NULL DEFAULT true,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "PackageId" INTEGER,
    "EstimateId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "Price" DECIMAL(18,2) NOT NULL,
    "Qty" INTEGER NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateProducts_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EstimateServices" (
    "Id" SERIAL NOT NULL,
    "IsPackage" BOOLEAN NOT NULL,
    "IsRequired" BOOLEAN NOT NULL DEFAULT true,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "PackageId" INTEGER,
    "EstimateId" INTEGER NOT NULL,
    "ServiceId" INTEGER NOT NULL,
    "Rate" DECIMAL(18,2) NOT NULL,
    "Hours" DECIMAL(18,2) NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateServices_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EstimateTechnicians" (
    "Id" SERIAL NOT NULL,
    "EstimateId" INTEGER NOT NULL,
    "TechnicianUserId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateTechnicians_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Expenses" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsPaid" BOOLEAN NOT NULL,
    "ReferenceNo" VARCHAR(100) NOT NULL,
    "ExpenseDateTime" TIMESTAMP(3) NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "PayTo" VARCHAR(100) NOT NULL,
    "Remarks" TEXT NOT NULL,
    "PaymentReferenceNo" VARCHAR(100),
    "PaymentTypeParameterId" INTEGER NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "ExpenseByUserId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expenses_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Inspections" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "ReferenceNo" VARCHAR(100) NOT NULL,
    "TransactionDate" TIMESTAMP(3) NOT NULL,
    "ExpirationDate" TIMESTAMP(3),
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "VehicleId" INTEGER NOT NULL,
    "AdvisorUserId" INTEGER NOT NULL,
    "EstimatorUserId" INTEGER NOT NULL,
    "ApproverUserId" INTEGER NOT NULL,
    "ServiceGroupId" INTEGER NOT NULL,
    "InspectorUserId" INTEGER NOT NULL,
    "Odometer" INTEGER,
    "VehicleFindings" TEXT,
    "InspectionDetails" TEXT NOT NULL,
    "Remarks" TEXT,
    "DiagnosticResult" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspections_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistTemplates" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(120) NOT NULL,
    "Description" VARCHAR(500),
    "Revision" INTEGER NOT NULL DEFAULT 1,
    "IsActive" BOOLEAN NOT NULL DEFAULT false,
    "ChecklistJson" TEXT NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistTemplates_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "InspectionTechnicians" (
    "Id" SERIAL NOT NULL,
    "InspectionId" INTEGER NOT NULL,
    "TechnicianUserId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTechnicians_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Invoices" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsPackage" BOOLEAN NOT NULL,
    "InvoiceNo" VARCHAR(100) NOT NULL,
    "InvoiceDate" TIMESTAMP(3),
    "DueDate" TIMESTAMP(3),
    "JobOrderId" INTEGER NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "CustomerPO" VARCHAR(100),
    "AdvisorUserId" INTEGER NOT NULL,
    "Summary" VARCHAR(255),
    "SubTotal" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "LaborDiscount" DECIMAL(18,2) NOT NULL,
    "ProductDiscount" DECIMAL(18,2) NOT NULL,
    "AdditionalDiscount" DECIMAL(18,2) NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoices_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "InvoicePackages" (
    "Id" SERIAL NOT NULL,
    "InvoiceId" INTEGER NOT NULL,
    "PackageId" INTEGER NOT NULL,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoicePackages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobOrders" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsPackage" BOOLEAN NOT NULL,
    "IsPaid" BOOLEAN NOT NULL,
    "EstimateId" INTEGER NOT NULL,
    "ReferenceNo" VARCHAR(255) NOT NULL,
    "TransactionDate" TIMESTAMP(3),
    "ExpirationDate" TIMESTAMP(3),
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "VehicleId" INTEGER NOT NULL,
    "AdvisorUserId" INTEGER NOT NULL,
    "EstimatorUserId" INTEGER NOT NULL,
    "ApproverUserId" INTEGER NOT NULL,
    "ServiceGroupId" INTEGER NOT NULL,
    "Odometer" INTEGER,
    "NextOdometerReminder" INTEGER,
    "InvoiceId" INTEGER,
    "CustomerPO" VARCHAR(100),
    "Summary" VARCHAR(255),
    "SubTotal" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "LaborDiscount" DECIMAL(18,2) NOT NULL,
    "ProductDiscount" DECIMAL(18,2) NOT NULL,
    "AdditionalDiscount" DECIMAL(18,2) NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrders_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobOrderPackages" (
    "Id" SERIAL NOT NULL,
    "JobOrderId" INTEGER NOT NULL,
    "PackageId" INTEGER NOT NULL,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrderPackages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobOrderProducts" (
    "Id" SERIAL NOT NULL,
    "IsPackage" BOOLEAN NOT NULL,
    "IsRequired" BOOLEAN NOT NULL DEFAULT true,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "PackageId" INTEGER,
    "JobOrderId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "Price" DECIMAL(18,2) NOT NULL,
    "Qty" INTEGER NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrderProducts_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobOrderServices" (
    "Id" SERIAL NOT NULL,
    "IsPackage" BOOLEAN NOT NULL,
    "IsRequired" BOOLEAN NOT NULL DEFAULT true,
    "IsAdditional" BOOLEAN NOT NULL DEFAULT false,
    "PackageId" INTEGER,
    "JobOrderId" INTEGER NOT NULL,
    "ServiceId" INTEGER NOT NULL,
    "Rate" DECIMAL(18,2) NOT NULL,
    "Hours" DECIMAL(18,2) NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrderServices_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobOrderTechnicians" (
    "Id" SERIAL NOT NULL,
    "JobOrderId" INTEGER NOT NULL,
    "TechnicianUserId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrderTechnicians_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "JobStatuses" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStatuses_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Manufacturers" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturers_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Memberships" (
    "Id" SERIAL NOT NULL,
    "MembershipNo" VARCHAR(50) NOT NULL,
    "MembershipDate" TIMESTAMP(3) NOT NULL,
    "ExpiryDate" TIMESTAMP(3) NOT NULL,
    "PointsEarned" DECIMAL(18,0) NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memberships_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "OperationAccessCodes" (
    "Id" SERIAL NOT NULL,
    "CodeHash" VARCHAR(128) NOT NULL,
    "CodeSalt" VARCHAR(128) NOT NULL,
    "CodeSuffix" VARCHAR(2) NOT NULL,
    "CodeValue" VARCHAR(6),
    "GeneratedById" INTEGER NOT NULL,
    "GeneratedDateTime" TIMESTAMP(3) NOT NULL,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "UsedById" INTEGER,
    "UsedDateTime" TIMESTAMP(3),
    "UsedForAction" VARCHAR(100),
    "UsedForReferenceId" INTEGER,

    CONSTRAINT "OperationAccessCodes_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Packages" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Code" VARCHAR(50) NOT NULL,
    "NextServiceReminderDays" INTEGER NOT NULL DEFAULT 0,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IsHideAmount" BOOLEAN NOT NULL,
    "IsHideService" BOOLEAN NOT NULL,
    "IsHidePartsAndMaterials" BOOLEAN NOT NULL,
    "IsDisplayCode" BOOLEAN NOT NULL,
    "Summary" TEXT,
    "SubTotal" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Packages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PackageProducts" (
    "Id" SERIAL NOT NULL,
    "PackageId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "Price" DECIMAL(18,2) NOT NULL,
    "Qty" INTEGER NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageProducts_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PackageServices" (
    "Id" SERIAL NOT NULL,
    "PackageId" INTEGER NOT NULL,
    "ServiceId" INTEGER NOT NULL,
    "Rate" DECIMAL(18,2) NOT NULL,
    "Hours" DECIMAL(18,2) NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageServices_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Parameters" (
    "Id" SERIAL NOT NULL,
    "ParameterGroupId" INTEGER NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Code" VARCHAR(50) NOT NULL,
    "Description" TEXT,
    "SortOrder" INTEGER NOT NULL,
    "NumericData" INTEGER NOT NULL,
    "OtherData" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parameters_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ParameterGroups" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Code" VARCHAR(50) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterGroups_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Payments" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "IsFullyPaid" BOOLEAN NOT NULL,
    "ReferenceNo" VARCHAR(100) NOT NULL,
    "PaymentDate" TIMESTAMP(3) NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "InvoiceTotalAmount" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "DepositAmount" DECIMAL(18,2) NOT NULL,
    "AmountPayable" DECIMAL(18,2) NOT NULL,
    "TotalPaidAmount" DECIMAL(18,2) NOT NULL,
    "Balance" DECIMAL(18,2) NOT NULL,
    "Remarks" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PaymentDetails" (
    "Id" SERIAL NOT NULL,
    "PaymentId" INTEGER NOT NULL,
    "PaymentTypeParameterId" INTEGER NOT NULL,
    "InvoiceId" INTEGER NOT NULL,
    "IsFullyPaid" BOOLEAN NOT NULL DEFAULT false,
    "AmountPaid" DECIMAL(18,2) NOT NULL,
    "IsDeposit" BOOLEAN NOT NULL DEFAULT false,
    "PaymentDate" TIMESTAMP(3),
    "PaymentReferenceNo" VARCHAR(255),
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDetails_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "Id" SERIAL NOT NULL,
    "Key" VARCHAR(150) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "Group" VARCHAR(80) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PettyCash" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "PCNo" VARCHAR(50) NOT NULL,
    "TransactionDateTime" TIMESTAMP(3) NOT NULL,
    "JobStatusId" INTEGER,
    "PayTo" TEXT NOT NULL,
    "Particulars" TEXT,
    "CashIn" DECIMAL(18,2) NOT NULL,
    "CashOut" DECIMAL(18,2) NOT NULL,
    "Balance" DECIMAL(18,2) NOT NULL,
    "PaidByUserId" INTEGER NOT NULL,
    "PaymentReceivedBy" TEXT NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCash_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Products" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "DisplayName" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "PartNo" VARCHAR(50),
    "ProductGroupId" INTEGER NOT NULL,
    "ProductCategoryId" INTEGER NOT NULL,
    "UnitOfMeasureId" INTEGER NOT NULL,
    "ManufacturerId" INTEGER NOT NULL,
    "SupplierId" INTEGER NOT NULL,
    "ExpirationDateTime" TIMESTAMP(3),
    "PurchaseCost" DECIMAL(18,2) NOT NULL,
    "MarkupRate" DECIMAL(18,2) NOT NULL,
    "SellingPrice" DECIMAL(18,2) NOT NULL,
    "IncentiveSA" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IncentiveTech" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "StorageLocation" TEXT,
    "LowStockThreshold" DECIMAL(18,2) NOT NULL DEFAULT 5,
    "IsQuickSalesProduct" BOOLEAN NOT NULL DEFAULT false,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductCategories" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategories_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductGroups" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroups_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductInventoryChecks" (
    "Id" SERIAL NOT NULL,
    "CheckType" VARCHAR(30) NOT NULL,
    "CheckDate" DATE NOT NULL,
    "Notes" VARCHAR(500),
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInventoryChecks_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductInventoryCheckItems" (
    "Id" SERIAL NOT NULL,
    "ProductInventoryCheckId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "SystemQuantity" DECIMAL(18,2) NOT NULL,
    "PhysicalQuantity" DECIMAL(18,2) NOT NULL,
    "Variance" DECIMAL(18,2) NOT NULL,
    "Notes" VARCHAR(500),
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInventoryCheckItems_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductInventoryTransactions" (
    "Id" SERIAL NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "TransactionType" VARCHAR(30) NOT NULL,
    "Quantity" DECIMAL(18,2) NOT NULL,
    "TransactionDateTime" TIMESTAMP(3) NOT NULL,
    "ReferenceNo" VARCHAR(100),
    "Notes" VARCHAR(500),
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInventoryTransactions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductVehicleModels" (
    "Id" SERIAL NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "VehicleModelId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVehicleModels_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "QuickSales" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "ReferenceNo" VARCHAR(100) NOT NULL,
    "TransactionDate" TIMESTAMP(3) NOT NULL,
    "JobStatusId" INTEGER NOT NULL,
    "CustomerId" INTEGER NOT NULL,
    "PaymentTypeParameterId" INTEGER NOT NULL,
    "PaymentReferenceNo" VARCHAR(255),
    "SalesPersonUserId" INTEGER NOT NULL,
    "Summary" TEXT,
    "SubTotal" DECIMAL(18,2) NOT NULL,
    "VAT12" DECIMAL(18,2) NOT NULL,
    "Discount" DECIMAL(18,2) NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "Payment" DECIMAL(18,2) NOT NULL,
    "Change" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickSales_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "QuickSalesProducts" (
    "Id" SERIAL NOT NULL,
    "QuickSalesId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "Price" DECIMAL(18,2) NOT NULL,
    "Qty" INTEGER NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickSalesProducts_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Roles" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "RolePermissions" (
    "Id" SERIAL NOT NULL,
    "RoleId" INTEGER NOT NULL,
    "PermissionId" INTEGER NOT NULL,
    "Allowed" BOOLEAN NOT NULL DEFAULT false,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermissions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Services" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Code" VARCHAR(100) NOT NULL,
    "ServiceGroupId" INTEGER NOT NULL,
    "ServiceCategoryId" INTEGER NOT NULL,
    "StandardRate" DECIMAL(18,2) NOT NULL,
    "StandardHours" DECIMAL(18,2) NOT NULL,
    "IsReplacement" BOOLEAN NOT NULL,
    "IsAllowRateOverride" BOOLEAN NOT NULL,
    "IsMechanicRequired" BOOLEAN NOT NULL,
    "DisplayStandardHours" BOOLEAN NOT NULL,
    "DisplayStandardRate" BOOLEAN NOT NULL,
    "DisplayNotes" BOOLEAN NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Services_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ServiceCategories" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategories_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ServiceGroups" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceGroups_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Suppliers" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Address" VARCHAR(255),
    "ContactPerson" VARCHAR(100) NOT NULL,
    "ContactNumber" VARCHAR(50) NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suppliers_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasures" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasures_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Users" (
    "Id" SERIAL NOT NULL,
    "Email" VARCHAR(100) NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "Salt" TEXT NOT NULL,
    "PinHash" TEXT NOT NULL,
    "PinSalt" TEXT NOT NULL,
    "RoleId" INTEGER NOT NULL,
    "Gender" INTEGER NOT NULL,
    "Firstname" VARCHAR(100) NOT NULL,
    "MiddleName" VARCHAR(100),
    "LastName" VARCHAR(100) NOT NULL,
    "MobileNumber" VARCHAR(50),
    "Birthday" TIMESTAMP(3) NOT NULL,
    "Address" TEXT,
    "IsActive" BOOLEAN NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserRoles" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "RoleId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Vehicles" (
    "Id" SERIAL NOT NULL,
    "IsChangan" BOOLEAN NOT NULL DEFAULT false,
    "CustomerId" INTEGER NOT NULL,
    "PlateNo" VARCHAR(50) NOT NULL,
    "VehicleModelId" INTEGER NOT NULL,
    "VIN" TEXT,
    "YearModel" INTEGER NOT NULL,
    "EngineNo" TEXT,
    "ChasisNo" TEXT,
    "TransmissionParameterId" INTEGER NOT NULL,
    "OdometerParameterId" INTEGER NOT NULL,
    "CustomerRegistrationTypeParameterId" INTEGER NOT NULL,
    "EngineSizeParameterId" INTEGER NOT NULL,
    "EngineTypeParameterId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "VehicleMakes" (
    "Id" SERIAL NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "RegionParameterId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMakes_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "VehicleModels" (
    "Id" SERIAL NOT NULL,
    "VehicleMakeId" INTEGER NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" TEXT,
    "BodyParameterId" INTEGER NOT NULL,
    "ClassificationParameterId" INTEGER NOT NULL,
    "CreatedById" INTEGER NOT NULL,
    "CreatedDateTime" TIMESTAMP(3) NOT NULL,
    "UpdatedById" INTEGER NOT NULL,
    "UpdatedDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleModels_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "IX_CameraEvents_EventDateTime" ON "CameraEvents"("EventDateTime");

-- CreateIndex
CREATE INDEX "IX_CameraEvents_Type_State_DateTime" ON "CameraEvents"("EventType", "EventState", "EventDateTime");

-- CreateIndex
CREATE INDEX "IX_CameraEvents_CameraIp_EventDateTime" ON "CameraEvents"("CameraIp", "EventDateTime");

-- CreateIndex
CREATE INDEX "IX_OperationAccessCodes_GeneratedDateTime" ON "OperationAccessCodes"("GeneratedDateTime", "Id");

-- CreateIndex
CREATE INDEX "IX_OperationAccessCodes_UsedDateTime_ExpiresAt" ON "OperationAccessCodes"("UsedDateTime", "ExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UX_Permissions_Key" ON "Permissions"("Key");

-- CreateIndex
CREATE UNIQUE INDEX "UX_ProductInventoryChecks_CheckType_CheckDate" ON "ProductInventoryChecks"("CheckType", "CheckDate");

-- CreateIndex
CREATE INDEX "IX_ProductInventoryCheckItems_ProductInventoryCheckId" ON "ProductInventoryCheckItems"("ProductInventoryCheckId");

-- CreateIndex
CREATE INDEX "IX_ProductInventoryCheckItems_ProductId" ON "ProductInventoryCheckItems"("ProductId");

-- CreateIndex
CREATE UNIQUE INDEX "UX_ProductInventoryCheckItems_Check_Product" ON "ProductInventoryCheckItems"("ProductInventoryCheckId", "ProductId");

-- CreateIndex
CREATE INDEX "IX_ProductVehicleModels_VehicleModelId" ON "ProductVehicleModels"("VehicleModelId");

-- CreateIndex
CREATE UNIQUE INDEX "UX_ProductVehicleModels_ProductId_VehicleModelId" ON "ProductVehicleModels"("ProductId", "VehicleModelId");

-- CreateIndex
CREATE UNIQUE INDEX "UX_RolePermissions_RoleId_PermissionId" ON "RolePermissions"("RoleId", "PermissionId");

-- CreateIndex
-- SQL Server filtered unique index equivalent: one primary company row.
CREATE UNIQUE INDEX "UX_CompanyInfos_PrimaryCompany" ON "CompanyInfos"("IsPrimaryCompany") WHERE "IsPrimaryCompany" = true;

-- CreateIndex
-- SQL Server filtered unique index equivalent: one active inspection checklist template.
CREATE UNIQUE INDEX "UX_InspectionChecklistTemplates_Active" ON "InspectionChecklistTemplates"("IsActive") WHERE "IsActive" = true;

-- AddForeignKey
ALTER TABLE "Deposits" ADD CONSTRAINT "FK_Deposit_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Deposits" ADD CONSTRAINT "FK_Deposit_JobOrder" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Deposits" ADD CONSTRAINT "FK_Deposit_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Deposits" ADD CONSTRAINT "FK_Deposit_PaymentTypeParameter" FOREIGN KEY ("PaymentTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_AdvisorUser" FOREIGN KEY ("AdvisorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_Approver" FOREIGN KEY ("ApproverUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_EstimatorUser" FOREIGN KEY ("EstimatorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_ServiceGroup" FOREIGN KEY ("ServiceGroupId") REFERENCES "ServiceGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Estimates" ADD CONSTRAINT "FK_Estimate_Vehicle" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimatePackages" ADD CONSTRAINT "FK_EstimatePackage_Estimate" FOREIGN KEY ("EstimateId") REFERENCES "Estimates"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimatePackages" ADD CONSTRAINT "FK_EstimatePackage_Package" FOREIGN KEY ("PackageId") REFERENCES "Packages"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimateProducts" ADD CONSTRAINT "FK_EstimateProduct_Estimate" FOREIGN KEY ("EstimateId") REFERENCES "Estimates"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimateProducts" ADD CONSTRAINT "FK_EstimateProduct_Product" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimateServices" ADD CONSTRAINT "FK_EstimateService_Estimate" FOREIGN KEY ("EstimateId") REFERENCES "Estimates"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimateServices" ADD CONSTRAINT "FK_EstimateService_EstimateService" FOREIGN KEY ("ServiceId") REFERENCES "Services"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimateTechnicians" ADD CONSTRAINT "FK_EstimateTechnician_User" FOREIGN KEY ("TechnicianUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "FK_Expenses_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "FK_Expenses_PaymentTypeParameter" FOREIGN KEY ("PaymentTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "FK_Expenses_User" FOREIGN KEY ("ExpenseByUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_AdvisorUser" FOREIGN KEY ("AdvisorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_EstimatorUser" FOREIGN KEY ("EstimatorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_InspectorUser" FOREIGN KEY ("InspectorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_ServiceGroup" FOREIGN KEY ("ServiceGroupId") REFERENCES "ServiceGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Inspections" ADD CONSTRAINT "FK_Inspection_Vehicle" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InspectionTechnicians" ADD CONSTRAINT "FK_InspectionTechnician_Inspection" FOREIGN KEY ("InspectionId") REFERENCES "Inspections"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InspectionTechnicians" ADD CONSTRAINT "FK_InspectionTechnician_User" FOREIGN KEY ("TechnicianUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invoices" ADD CONSTRAINT "FK_Invoice_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invoices" ADD CONSTRAINT "FK_Invoice_JobOrder" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invoices" ADD CONSTRAINT "FK_Invoice_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invoices" ADD CONSTRAINT "FK_Invoice_User" FOREIGN KEY ("AdvisorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InvoicePackages" ADD CONSTRAINT "FK_InvoicePackage_Invoice" FOREIGN KEY ("InvoiceId") REFERENCES "Invoices"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InvoicePackages" ADD CONSTRAINT "FK_InvoicePackage_Package" FOREIGN KEY ("PackageId") REFERENCES "Packages"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_AdvisorUser" FOREIGN KEY ("AdvisorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_ApproverUser" FOREIGN KEY ("ApproverUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_Estimate" FOREIGN KEY ("EstimateId") REFERENCES "Estimates"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_EstimatorUser" FOREIGN KEY ("EstimatorUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_ServiceGroup" FOREIGN KEY ("ServiceGroupId") REFERENCES "ServiceGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrders" ADD CONSTRAINT "FK_JobOrder_Vehicle" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderPackages" ADD CONSTRAINT "FK_JobOrderPackage_JobOrderPackage" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderPackages" ADD CONSTRAINT "FK_JobOrderPackage_Package" FOREIGN KEY ("PackageId") REFERENCES "Packages"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderProducts" ADD CONSTRAINT "FK_JobOrderProduct_JobOrder" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderProducts" ADD CONSTRAINT "FK_JobOrderProduct_Product" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderServices" ADD CONSTRAINT "FK_JobOrderService_JobOrder" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderServices" ADD CONSTRAINT "FK_JobOrderService_Service" FOREIGN KEY ("ServiceId") REFERENCES "Services"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderTechnicians" ADD CONSTRAINT "FK_JobOrderTechnician_JobOrder" FOREIGN KEY ("JobOrderId") REFERENCES "JobOrders"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JobOrderTechnicians" ADD CONSTRAINT "FK_JobOrderTechnician_User" FOREIGN KEY ("TechnicianUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Memberships" ADD CONSTRAINT "FK_Membership_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PackageProducts" ADD CONSTRAINT "FK_PackageProduct_Package" FOREIGN KEY ("PackageId") REFERENCES "Packages"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PackageProducts" ADD CONSTRAINT "FK_PackageProduct_Product" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PackageServices" ADD CONSTRAINT "FK_PackageService_Package" FOREIGN KEY ("PackageId") REFERENCES "Packages"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PackageServices" ADD CONSTRAINT "FK_PackageService_Service" FOREIGN KEY ("ServiceId") REFERENCES "Services"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Parameters" ADD CONSTRAINT "FK_Parameter_ParameterGroup" FOREIGN KEY ("ParameterGroupId") REFERENCES "ParameterGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payment_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payment_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentDetails" ADD CONSTRAINT "FK_PaymentDetails_Invoice" FOREIGN KEY ("InvoiceId") REFERENCES "Invoices"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentDetails" ADD CONSTRAINT "FK_PaymentDetails_Payment" FOREIGN KEY ("PaymentId") REFERENCES "Payments"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentDetails" ADD CONSTRAINT "FK_PaymentDetails_PaymentTypeParameter" FOREIGN KEY ("PaymentTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PettyCash" ADD CONSTRAINT "FK_PettyCash_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PettyCash" ADD CONSTRAINT "FK_PettyCash_PaidBy_User" FOREIGN KEY ("PaidByUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Product_Manufacturer" FOREIGN KEY ("ManufacturerId") REFERENCES "Manufacturers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Product_ProductCategory" FOREIGN KEY ("ProductCategoryId") REFERENCES "ProductCategories"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Product_ProductGroup" FOREIGN KEY ("ProductGroupId") REFERENCES "ProductGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Product_Supplier" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "FK_Product_UnitOfMeasure" FOREIGN KEY ("UnitOfMeasureId") REFERENCES "UnitOfMeasures"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductInventoryCheckItems" ADD CONSTRAINT "FK_ProductInventoryCheckItems_ProductInventoryChecks" FOREIGN KEY ("ProductInventoryCheckId") REFERENCES "ProductInventoryChecks"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductInventoryCheckItems" ADD CONSTRAINT "FK_ProductInventoryCheckItems_Products" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductInventoryTransactions" ADD CONSTRAINT "FK_ProductInventoryTransactions_Products" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductVehicleModels" ADD CONSTRAINT "FK_ProductVehicleModels_Products" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductVehicleModels" ADD CONSTRAINT "FK_ProductVehicleModels_VehicleModels" FOREIGN KEY ("VehicleModelId") REFERENCES "VehicleModels"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSales" ADD CONSTRAINT "FK_QuickSales_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSales" ADD CONSTRAINT "FK_QuickSales_JobStatus" FOREIGN KEY ("JobStatusId") REFERENCES "JobStatuses"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSales" ADD CONSTRAINT "FK_QuickSales_PaymentTypeParameter" FOREIGN KEY ("PaymentTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSales" ADD CONSTRAINT "FK_QuickSales_SalesPersonUser" FOREIGN KEY ("SalesPersonUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSalesProducts" ADD CONSTRAINT "FK_QuickSalesProduct_Product" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuickSalesProducts" ADD CONSTRAINT "FK_QuickSalesProduct_QuickSales" FOREIGN KEY ("QuickSalesId") REFERENCES "QuickSales"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "FK_RolePermissions_Permissions" FOREIGN KEY ("PermissionId") REFERENCES "Permissions"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "FK_RolePermissions_Roles" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Services" ADD CONSTRAINT "FK_Service_ServiceCategory" FOREIGN KEY ("ServiceCategoryId") REFERENCES "ServiceCategories"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Services" ADD CONSTRAINT "FK_Service_ServiceGroup" FOREIGN KEY ("ServiceGroupId") REFERENCES "ServiceGroups"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "FK_User_Role" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "FK_UserRoles_Role" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "FK_UserRoles_User" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_Customer" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_CustomerRegistrationType_Parameter" FOREIGN KEY ("CustomerRegistrationTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_EngineSize_Parameter" FOREIGN KEY ("EngineSizeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_EngineType_Parameter" FOREIGN KEY ("EngineTypeParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_Odometer_Parameter" FOREIGN KEY ("OdometerParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_Transmission_Parameter" FOREIGN KEY ("TransmissionParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vehicles" ADD CONSTRAINT "FK_Vehicle_VehicleModel" FOREIGN KEY ("VehicleModelId") REFERENCES "VehicleModels"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VehicleMakes" ADD CONSTRAINT "FK_VehicleMake_Parameter" FOREIGN KEY ("RegionParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VehicleModels" ADD CONSTRAINT "FK_VehicleModel_BodyParameter" FOREIGN KEY ("BodyParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VehicleModels" ADD CONSTRAINT "FK_VehicleModel_ClassificationParameter" FOREIGN KEY ("ClassificationParameterId") REFERENCES "Parameters"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VehicleModels" ADD CONSTRAINT "FK_VehicleModel_VehicleMake" FOREIGN KEY ("VehicleMakeId") REFERENCES "VehicleMakes"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;
