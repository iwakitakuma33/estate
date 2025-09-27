from enum import Enum
from pydantic import BaseModel, Field

from sympy import symbols, Eq, solve


from datetime import date


class BuildingType(str, Enum):
    TREE = "木造"
    CONCRETE = "コンクリート"


class Building(BaseModel):
    bd_registration_cost: int = Field(title="建物登記費用", default=80000)
    bd_init_reform_cost: float = Field(title="初期リフォーム費用")
    bd_price: float = Field(title="物件価格")
    bd_remove_leaves_cost: float = Field(title="残置物撤去費用")
    bd_room_count: int = Field(title="部屋数")
    bd_leaves_on_purchase: int = Field(title="購入時築年数", default=0)
    bd_type: BuildingType = Field(title="造り", default=BuildingType.TREE)


class BuildingInfo(BaseModel):
    bd_tax_eval_price: float = Field(title="建物の固定資産課税台帳登録額")
    bd_tax_account_price: float = Field(title="建物の固定資産税評価額")
    bd_empty_ratio: float = Field(title="空室率")
    bd_empty_ratio_on_sell: float | None = Field(title="売却時空室率")
    bd_repair_cost: float = Field(title="修繕費")
    bd_repair_prepare_cost: float = Field(title="修繕積立金", default=0)


class Land(BaseModel):
    ld_registration_cost: int = Field(title="土地登記費用", default=80000)
    ld_price: int = Field(title="土地価格")


class LandInfo(BaseModel):
    ld_tax_eval_price: int = Field(title="土地の固定資産税評価額")
    ld_tax_account_price: int = Field(title="土地の固定資産課税台帳登録額")


class LoanType(Enum):
    ADJUSTABLE = "変動金利"
    FIXED = "固定金利"


class LoanPayType(Enum):
    LEVEL = "元利均等返済"
    PRINCIPAL = "元金均等返済"


class Loan(BaseModel):
    ln_monthes: int = Field(title="返済月数")
    ln_amount: int = Field(title="総額")
    ln_payment_type: LoanPayType = Field(
        title="元本均等、元利均等", default=LoanPayType.LEVEL
    )
    ln_start: date = Field(title="ローン開始日", default=date.today())
    ln_type: LoanType = Field(title="変動、固定", default=LoanType.FIXED)
    ln_init_amount: int = Field(title="頭金", default=0)
    ln_buffer: int = Field(title="バッファ", default=0)


class LoanInfo(BaseModel):
    ln_raio: float = Field(title="利率")


class Estate(BaseModel):
    et_target_ratio: float = Field(title="表面利回り")
    et_net_ratio: float = Field(title="実質利回り")
