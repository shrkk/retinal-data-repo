from typing import List
from pydantic import BaseModel, Field

class PlotData(BaseModel):
    x: List[float] = Field(..., example=[1.6, 2.3, 2.8])
    y: List[float] = Field(..., example=[41.1, 47.3, 53.5])
    cone_type: List[str] = Field(..., example=["M","L","S"])
